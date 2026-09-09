import type { LanguageModel, ModelMessage } from "ai";
import type { z } from "zod";
import {
  aiSchemaInstruction,
  requireCompleteAiText,
  MAX_AI_TEXT_CHARS,
} from "./ai-response.contract";
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
    abortSignal?: AbortSignal;
    /** The orchestrator reserves once before a provider fallback route. */
    reserveQuota?: boolean;
  },
): Promise<T> {
  const { generateText } = await import("ai");

  const system = [opts.system, INSTRUCTION, aiSchemaInstruction(opts.schema)]
    .filter(Boolean)
    .join("\n\n");

  let text: string;
  try {
    opts.abortSignal?.throwIfAborted();
    if (opts.reserveQuota !== false) await reserveAiRequest(opts.userId);
    opts.abortSignal?.throwIfAborted();
    const generated = await generateText({
      model,
      system,
      ...(opts.messages
        ? { messages: opts.messages }
        : { prompt: `${opts.prompt ?? ""}\n\n${INSTRUCTION}` }),
      maxOutputTokens: opts.maxOutputTokens ?? 16000,
      maxRetries: 0,
      ...(opts.abortSignal ? { abortSignal: opts.abortSignal } : {}),
      // Reasoning tokens count against the output budget and were truncating
      // JSON answers mid-object, so we ask the model to answer directly.
    });
    text = requireCompleteAiText(generated.text, generated.finishReason);
  } catch (error) {
    throw normalizeAiError(error);
  }

  return parseAiJson(text, opts.schema);
}

/** Validates raw provider output before it can enter a domain model. */
export function parseAiJson<T>(text: string, schema: z.ZodType<T, unknown>): T {
  try {
    return schema.parse(extractJson(text));
  } catch {
    throw new Error("AI_INVALID_RESPONSE");
  }
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
  if (error instanceof AiUnavailableError) return error;
  if (error instanceof Error && /^(AI_[A-Z_]+)(?::|$)/.test(error.message)) {
    const code = error.message.split(":")[0]!;
    if (code === "AI_MODEL_UNAVAILABLE") return new AiUnavailableError("other", code);
    if (code === "AI_TIMEOUT") return new AiUnavailableError("provider_unavailable", code);
    return new Error(code);
  }
  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError"))
    return new AiUnavailableError("provider_unavailable", "AI_TIMEOUT");

  const status = numberProperty(error, "statusCode") ?? numberProperty(error, "status") ?? 0;
  const text =
    `${stringProperty(error, "message") ?? ""} ${stringProperty(error, "responseBody") ?? ""}`.toLowerCase();

  if (status === 401 || status === 403)
    return new AiUnavailableError("other", "AI_MODEL_UNAVAILABLE");
  if (
    status === 402 ||
    text.includes("payment required") ||
    (status !== 0 && (text.includes("insufficient_quota") || text.includes("insufficient credits")))
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
    [
      "AI_MODEL_UNAVAILABLE",
      "AI_CREDITS",
      "AI_RATE_LIMIT",
      "AI_PROVIDER_UNAVAILABLE",
      "AI_TIMEOUT",
    ].includes(error.message)
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
  if (typeof text !== "string" || text.length > MAX_AI_TEXT_CHARS)
    throw new Error("AI_INVALID_RESPONSE");
  const raw = text.trim();
  const fences = [...raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  if (fences.length > 1) throw new Error("AI_INVALID_RESPONSE");
  // Tolerate one complete presentation fence; never manufacture a missing tail,
  // edit quotes inside food names, or choose one of multiple JSON objects.
  const candidate = fences.length === 1 ? fences[0]![1]!.trim() : raw;
  if (!candidate.startsWith("{") && !candidate.startsWith("["))
    throw new Error("AI_INVALID_RESPONSE");
  try {
    return JSON.parse(candidate);
  } catch {
    throw new Error("AI_INVALID_RESPONSE");
  }
}
