import type { LanguageModel, ModelMessage } from "ai";
import type { z } from "zod";
import { reserveAiRequest } from "./ai-quota.server";

const INSTRUCTION =
  "OUTPUT FORMAT: Return ONLY a single valid JSON object. No markdown, no code fences, no commentary. All property names and string values must use double quotes. Keep strings short and never stop mid-object — the JSON must be complete and closed.";

/**
 * Providers may differ in structured-output support, so we ask for raw JSON and validate it ourselves.
 */
export async function generateJson<T>(
  model: LanguageModel,
  opts: {
    userId: string;
    prompt?: string;
    system?: string;
    messages?: ModelMessage[];
    schema: z.ZodType<T, unknown>;
    maxOutputTokens?: number;
    /** The orchestrator reserves once before a provider fallback route. */
    reserveQuota?: boolean;
  },
): Promise<T> {
  const { generateText } = await import("ai");

  const system = opts.system ? `${opts.system}\n\n${INSTRUCTION}` : INSTRUCTION;

  let text: string;
  try {
    if (opts.reserveQuota !== false) await reserveAiRequest(opts.userId);
    ({ text } = await generateText({
      model,
      system,
      ...(opts.messages
        ? { messages: opts.messages }
        : { prompt: `${opts.prompt ?? ""}\n\n${INSTRUCTION}` }),
      maxOutputTokens: opts.maxOutputTokens ?? 16000,
      maxRetries: 2,
      // Reasoning tokens count against the output budget and were truncating
      // JSON answers mid-object, so we ask the model to answer directly.
    }));
  } catch (error) {
    throw normalizeAiError(error);
  }

  return parseAiJson(text, opts.schema);
}

/** Validates raw provider output before it can enter a domain model. */
export function parseAiJson<T>(text: string, schema: z.ZodType<T, unknown>): T {
  return schema.parse(extractJson(text));
}

export type AiFailureKind = "credits" | "rate_limit" | "provider_unavailable" | "other";

/** Error thrown when the AI gateway itself refused the request. */
export class AiUnavailableError extends Error {
  kind: AiFailureKind;
  constructor(kind: AiFailureKind, message: string) {
    super(message);
    this.name = "AiUnavailableError";
    this.kind = kind;
  }
}

/**
 * Gateway errors surface as opaque provider errors ("Payment Required").
 * Translate them into a stable shape so callers can degrade gracefully.
 */
export function normalizeAiError(error: unknown): Error {
  const status = numberProperty(error, "statusCode") ?? numberProperty(error, "status") ?? 0;
  const text =
    `${stringProperty(error, "message") ?? ""} ${stringProperty(error, "responseBody") ?? ""}`.toLowerCase();

  if (
    status === 402 ||
    text.includes("payment required") ||
    text.includes("insufficient") ||
    text.includes("credit")
  ) {
    return new AiUnavailableError("credits", "AI_CREDITS");
  }
  if (status === 429 || text.includes("rate limit") || text.includes("too many requests")) {
    return new AiUnavailableError("rate_limit", "AI_RATE_LIMIT");
  }
  if (
    status === 408 ||
    status >= 500 ||
    text.includes("timeout") ||
    text.includes("timed out") ||
    text.includes("network error") ||
    text.includes("fetch failed") ||
    text.includes("service unavailable") ||
    text.includes("overloaded")
  ) {
    return new AiUnavailableError("provider_unavailable", "AI_PROVIDER_UNAVAILABLE");
  }
  if (
    text.includes("ai_model_unavailable") ||
    ((status === 400 || status === 404) &&
      (text.includes("model") || text.includes("does not exist") || text.includes("no access")))
  ) {
    return new AiUnavailableError("other", "AI_MODEL_UNAVAILABLE");
  }
  return error instanceof Error ? error : new Error(String(error));
}

/** A route may try its next provider only when the selected model is unavailable. */
export function isAiModelUnavailable(error: unknown): boolean {
  return error instanceof AiUnavailableError && error.message === "AI_MODEL_UNAVAILABLE";
}

/** Only provider-route failures can use another centrally approved worker. */
export function isAiProviderRecoverable(error: unknown): boolean {
  return (
    error instanceof AiUnavailableError &&
    ["AI_MODEL_UNAVAILABLE", "AI_CREDITS", "AI_RATE_LIMIT", "AI_PROVIDER_UNAVAILABLE"].includes(
      error.message,
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function numberProperty(value: unknown, key: string): number | undefined {
  if (!isRecord(value)) return undefined;
  const property = value[key];
  return typeof property === "number" ? property : undefined;
}

function stringProperty(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) return undefined;
  const property = value[key];
  return typeof property === "string" ? property : undefined;
}

function extractJson(text: string): unknown {
  let raw = text.trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) raw = fence[1].trim();

  const start = raw.indexOf("{");
  if (start === -1) throw new Error("AI response did not contain JSON.");

  const end = raw.lastIndexOf("}");
  const candidate = end > start ? raw.slice(start, end + 1) : raw.slice(start);

  const attempts = [
    candidate,
    sanitizeJson(candidate),
    repairJson(raw.slice(start)),
    sanitizeJson(repairJson(sanitizeJson(raw.slice(start)))),
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Invalid JSON from AI.");
}

/**
 * Models occasionally emit near-JSON: unquoted keys, single-quoted strings,
 * trailing commas or smart quotes. Normalise those before parsing.
 */
function sanitizeJson(input: string): string {
  let out = input
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/,(\s*[}\]])/g, "$1");

  // single-quoted strings -> double-quoted (only outside double-quoted strings)
  out = out.replace(/'([^'"\n]*)'(\s*[:,}\]])/g, '"$1"$2');

  // bare object keys -> quoted keys
  out = out.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g, '$1"$2"$3');

  return out;
}

/**
 * Long generations sometimes get cut off mid-array. We drop the unfinished
 * tail and close every open bracket so the usable part still parses.
 */
function repairJson(input: string): string {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  let lastSafe = -1;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") stack.push(ch === "{" ? "}" : "]");
    else if (ch === "}" || ch === "]") stack.pop();
    // a completed value at depth >= 1 is a safe truncation point
    if (!inString && (ch === "}" || ch === "]") && stack.length > 0) lastSafe = i;
  }

  let out = input;
  if (inString || lastSafe === -1) {
    out = input.slice(0, lastSafe + 1);
  } else {
    out = input.slice(0, lastSafe + 1);
  }
  out = out.replace(/,\s*$/, "");

  // recompute open brackets for the trimmed string and close them
  const open: string[] = [];
  let str = false;
  let esc = false;
  for (const ch of out) {
    if (str) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') str = false;
      continue;
    }
    if (ch === '"') str = true;
    else if (ch === "{") open.push("}");
    else if (ch === "[") open.push("]");
    else if (ch === "}" || ch === "]") open.pop();
  }
  return out + open.reverse().join("");
}
