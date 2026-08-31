import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function isAiConfigured(): boolean {
  return Boolean(process.env["GROQ_API_KEY"] || process.env["GEMINI_API_KEY"] || process.env["OPENAI_API_KEY"]);
}

export type AiTask =
  | "plan" | "nutrition" | "coach" | "workout" | "vision" | "translation"
  | "motivation" | "analysis" | "default";

type Provider = ReturnType<typeof createOpenAICompatible>;

function env(name: string): string | undefined {
  const value = process.env[name];
  return value?.trim() || undefined;
}

function makeGroq(): Provider | null {
  const key = env("GROQ_API_KEY");
  if (!key) return null;
  return createOpenAICompatible({
    name: "groq",
    baseURL: env("GROQ_BASE_URL") ?? "https://api.groq.com/openai/v1",
    apiKey: key,
  });
}

function makeGemini(): Provider | null {
  const key = env("GEMINI_API_KEY");
  if (!key) return null;
  return createOpenAICompatible({
    name: "gemini",
    baseURL: env("GEMINI_BASE_URL") ?? "https://generativelanguage.googleapis.com/v1beta/openai",
    apiKey: key,
  });
}

function makeOpenAI(): Provider | null {
  const key = env("OPENAI_API_KEY");
  if (!key) return null;
  return createOpenAICompatible({
    name: "openai",
    baseURL: env("OPENAI_BASE_URL") ?? "https://api.openai.com/v1",
    apiKey: key,
  });
}

/**
 * GYMS.LIFE AI Router.
 * The application owns the orchestration layer; providers are interchangeable
 * adapters. Tasks intentionally map to different models so one provider does
 * not become a single point of failure or a source of truth for user context.
 */
export function createAiRouterProvider(task: string): (model: string) => any {
  const normalized: AiTask = task.includes("vision") || task.includes("body-scan") || task.includes("food-vision")
    || task.includes("supplement-vision") || task.includes("smart")
    ? "vision"
    : task.includes("translation") || task.includes("i18n")
      ? "translation"
      : task.includes("motivation")
        ? "motivation"
        : task.includes("coach")
          ? "coach"
          : task.includes("nutrition") || task.includes("meal") || task.includes("micronutrient") || task.includes("fridge")
            ? "nutrition"
            : task.includes("plan") || task.includes("workout") || task.includes("exercise")
              ? "workout"
              : "analysis";

  const groq = makeGroq();
  const gemini = makeGemini();
  const openai = makeOpenAI();

  // Pair provider and model deliberately. A provider never receives a model it cannot host.
  const textFirst = ["motivation", "translation", "analysis"].includes(normalized);
  const selected = textFirst ? (groq ? { provider: groq, model: env("AI_TEXT_MODEL") ?? "llama-3.3-70b-versatile" } : null)
    : (gemini ? { provider: gemini, model: env("AI_GEMINI_MODEL") ?? "gemini-2.5-flash" } : null);
  const fallback = selected ?? (openai ? { provider: openai, model: env("OPENAI_MODEL") ?? "gpt-4.1-mini" } : null)
    ?? (groq ? { provider: groq, model: env("AI_TEXT_MODEL") ?? "llama-3.3-70b-versatile" } : null)
    ?? (gemini ? { provider: gemini, model: env("AI_GEMINI_MODEL") ?? "gemini-2.5-flash" } : null);

  if (!fallback) throw new Error("AI_NOT_CONFIGURED: add GROQ_API_KEY and/or GEMINI_API_KEY in your server environment.");

  let configuredModel = fallback.model;
  if (normalized === "vision") configuredModel = env("AI_VISION_MODEL") ?? (fallback.provider === gemini ? "gemini-2.5-flash" : fallback.model);
  if (normalized === "workout") configuredModel = env("AI_WORKOUT_MODEL") ?? (fallback.provider === gemini ? "gemini-2.5-flash" : fallback.model);
  if (normalized === "nutrition") configuredModel = env("AI_NUTRITION_MODEL") ?? (fallback.provider === gemini ? "gemini-2.5-flash" : fallback.model);
  if (normalized === "coach") configuredModel = env("AI_COACH_MODEL") ?? (fallback.provider === gemini ? "gemini-2.5-flash" : fallback.model);
  if (normalized === "translation") configuredModel = env("AI_TRANSLATION_MODEL") ?? (fallback.provider === groq ? "llama-3.3-70b-versatile" : fallback.model);
  if (normalized === "motivation") configuredModel = env("AI_MOTIVATION_MODEL") ?? (fallback.provider === groq ? "llama-3.3-70b-versatile" : fallback.model);
  if (normalized === "analysis") configuredModel = env("AI_DEFAULT_MODEL") ?? fallback.model;
  return (_requestedModel: string) => fallback.provider(configuredModel);
}
