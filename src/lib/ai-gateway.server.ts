import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModelV4 } from "@ai-sdk/provider";

const groqClient = createGroq({
  apiKey: process.env["GROQ_API_KEY"] ?? "",
});

const googleClient = createGoogleGenerativeAI({
  apiKey: process.env["GEMINI_API_KEY"] ?? "",
});

const openAiClient = createOpenAICompatible({
  name: "openai",
  baseURL: "https://api.openai.com/v1",
  apiKey: process.env["OPENAI_API_KEY"] ?? "",
});

export type AiModelId =
  | "google/gemini-2.5-flash"
  | "google/gemini-3.1-flash-lite"
  | "groq/openai/gpt-oss-120b"
  | "openai/gpt-4o-mini";

export function isAiConfigured(): boolean {
  return Boolean(
    process.env["GROQ_API_KEY"] || process.env["GEMINI_API_KEY"] || process.env["OPENAI_API_KEY"],
  );
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
 * Provider adapter only. An adapter never silently changes providers: the
 * orchestrator owns the full, observable fallback route for each task.
 */
export function createAiModel(modelId: AiModelId): LanguageModelV4 {
  if (modelId.startsWith("google/") && process.env["GEMINI_API_KEY"]) {
    return requireLanguageModel(googleClient(modelId.replace("google/", "")), modelId);
  }

  if (modelId.startsWith("groq/") && process.env["GROQ_API_KEY"]) {
    return requireLanguageModel(groqClient(modelId.replace("groq/", "")), modelId);
  }

  if (modelId.startsWith("openai/") && process.env["OPENAI_API_KEY"]) {
    return requireLanguageModel(openAiClient.chatModel(modelId.replace("openai/", "")), modelId);
  }

  throw new Error(`AI_MODEL_UNAVAILABLE:${modelId}`);
}
