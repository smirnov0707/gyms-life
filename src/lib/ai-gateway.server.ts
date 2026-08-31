import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function isAiConfigured(): boolean {
  return Boolean(
    process.env["GEMINI_API_KEY"] ||
    process.env["OPENROUTER_API_KEY"] ||
    process.env["GROQ_API_KEY"] ||
    process.env["OPENAI_API_KEY"] ||
    process.env["ANTHROPIC_API_KEY"]
  );
}

export type AiTask =
  | "plan"
  | "nutrition"
  | "coach"
  | "workout"
  | "vision"
  | "translation"
  | "motivation"
  | "analysis"
  | "default";

type Provider = ReturnType<typeof createOpenAICompatible>;

function env(name: string): string | undefined {
  const value = process.env[name];
  return value?.trim() || undefined;
}

function makeGemini(): { provider: Provider; defaultModel: string } | null {
  const key = env("GEMINI_API_KEY");
  if (!key) return null;
  return {
    provider: createOpenAICompatible({
      name: "gemini",
      baseURL: env("GEMINI_BASE_URL") ?? "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey: key,
    }),
    defaultModel: env("AI_GEMINI_MODEL") ?? "gemini-2.5-flash",
  };
}

function makeOpenRouter(): { provider: Provider; defaultModel: string } | null {
  const key = env("OPENROUTER_API_KEY");
  if (!key) return null;
  return {
    provider: createOpenAICompatible({
      name: "openrouter",
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: key,
      headers: {
        "HTTP-Referer": "https://gyms.life",
        "X-Title": "GYMS.LIFE Orchestrator",
      },
    }),
    defaultModel: env("AI_OPENROUTER_MODEL") ?? "anthropic/claude-3.5-sonnet",
  };
}

function makeGroq(): { provider: Provider; defaultModel: string } | null {
  const key = env("GROQ_API_KEY");
  if (!key) return null;
  return {
    provider: createOpenAICompatible({
      name: "groq",
      baseURL: env("GROQ_BASE_URL") ?? "https://api.groq.com/openai/v1",
      apiKey: key,
    }),
    defaultModel: env("AI_GROQ_MODEL") ?? "llama-3.3-70b-versatile",
  };
}

function makeOpenAI(): { provider: Provider; defaultModel: string } | null {
  const key = env("OPENAI_API_KEY");
  if (!key) return null;
  return {
    provider: createOpenAICompatible({
      name: "openai",
      baseURL: env("OPENAI_BASE_URL") ?? "https://api.openai.com/v1",
      apiKey: key,
    }),
    defaultModel: env("OPENAI_MODEL") ?? "gpt-4o-mini",
  };
}

/**
 * GYMS.LIFE Universal AI Orchestrator.
 * Dynamically routes requests across multiple foundation models:
 * - Vision & Scanner tasks -> Gemini Flash / GPT-4o Vision
 * - Deep Biomechanics & Coach -> Claude 3.5 Sonnet / DeepSeek / GPT-4o
 * - Fast Motivation & UI translation -> Groq Llama 3.3
 */
export function createAiRouterProvider(task: string): (model: string) => any {
  const normalized: AiTask =
    task.includes("vision") || task.includes("body-scan") || task.includes("food-vision") || task.includes("supplement-vision") || task.includes("smart")
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

  const gemini = makeGemini();
  const openrouter = makeOpenRouter();
  const groq = makeGroq();
  const openai = makeOpenAI();

  // Užduočių prioritetų matrica
  let primary: { provider: Provider; defaultModel: string } | null = null;

  if (normalized === "vision") {
    // Vizualiniai skenavimai: Gemini -> OpenAI -> OpenRouter
    primary = gemini ?? openai ?? openrouter ?? groq;
  } else if (normalized === "coach" || normalized === "workout") {
    // Gili analizė ir treneris: OpenRouter (Claude/DeepSeek) -> Gemini -> OpenAI -> Groq
    primary = openrouter ?? gemini ?? openai ?? groq;
  } else if (normalized === "translation" || normalized === "motivation") {
    // Greiti tekstai: Groq -> Gemini -> OpenRouter -> OpenAI
    primary = groq ?? gemini ?? openrouter ?? openai;
  } else {
    // Mityba ir kita: Gemini -> OpenRouter -> OpenAI -> Groq
    primary = gemini ?? openrouter ?? openai ?? groq;
  }

  if (!primary) {
    throw new Error(
      "AI_NOT_CONFIGURED: Prašome įrašyti bent vieną API raktą (.env faile: GEMINI_API_KEY, OPENROUTER_API_KEY, GROQ_API_KEY arba OPENAI_API_KEY)."
    );
  }

  return (requestedModel: string) => {
    const modelToUse = primary?.defaultModel || requestedModel;
    return primary!.provider(modelToUse);
  };
}
