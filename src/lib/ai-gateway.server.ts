import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModelV4 } from "@ai-sdk/provider";

const groqClient = createGroq({
  apiKey: process.env["GROQ_API_KEY"] ?? "",
});

const googleClient = createGoogleGenerativeAI({
  apiKey: process.env["GEMINI_API_KEY"] ?? "",
});

const GROQ_TEXT_MODEL = "openai/gpt-oss-120b";

export type AiModelId =
  "google/gemini-2.5-flash" | "google/gemini-3.1-flash-lite" | "groq/openai/gpt-oss-120b";

export function isAiConfigured(): boolean {
  return Boolean(process.env["GROQ_API_KEY"] || process.env["GEMINI_API_KEY"]);
}

/**
 * Keep an invalid provider adapter from reaching the AI SDK. The SDK's error
 * for this condition exposes its internal `specificationVersion` property,
 * which is neither actionable nor safe to show to a member.
 */
function requireLanguageModel(model: LanguageModelV4, modelId: AiModelId): LanguageModelV4 {
  if (model.specificationVersion !== "v4") {
    throw new Error(`AI_MODEL_UNAVAILABLE:${modelId}`);
  }
  return model;
}

/**
 * Provider adapter only. Business modules must receive models through the
 * GYMS.LIFE orchestrator so task policy and fallbacks stay centrally owned.
 */
export function createAiModel(modelId: AiModelId, allowProviderFallback = true): LanguageModelV4 {
  if (modelId.startsWith("google/") && process.env["GEMINI_API_KEY"]) {
    return requireLanguageModel(googleClient(modelId.replace("google/", "")), modelId);
  }

  if (modelId.startsWith("groq/") && process.env["GROQ_API_KEY"]) {
    return requireLanguageModel(groqClient(modelId.replace("groq/", "")), modelId);
  }

  if (allowProviderFallback && process.env["GROQ_API_KEY"]) {
    return requireLanguageModel(groqClient(GROQ_TEXT_MODEL), modelId);
  }

  if (allowProviderFallback && process.env["GEMINI_API_KEY"]) {
    return requireLanguageModel(googleClient("gemini-2.5-flash"), modelId);
  }

  throw new Error("AI is not configured for the requested task.");
}
