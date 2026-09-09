import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModelV4 } from "@ai-sdk/provider";

export type AiModelId =
  | "google/gemini-2.5-flash"
  | "google/gemini-3.1-flash-lite"
  | "groq/openai/gpt-oss-120b"
  | "openai/gpt-4o-mini"
  | "openrouter/meta-llama/llama-4-scout";

export function isAiConfigured(): boolean {
  return (
    process.env["AI_ENABLED"] !== "false" &&
    ["GROQ_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY", "OPENROUTER_API_KEY"].some((key) =>
      Boolean(process.env[key]?.trim()),
    )
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
  if (modelId.startsWith("google/") && process.env["GEMINI_API_KEY"]?.trim()) {
    return requireLanguageModel(
      createGoogleGenerativeAI({ apiKey: process.env["GEMINI_API_KEY"]!.trim() })(
        modelId.replace("google/", ""),
      ),
      modelId,
    );
  }

  if (modelId.startsWith("groq/") && process.env["GROQ_API_KEY"]?.trim()) {
    return requireLanguageModel(
      createGroq({ apiKey: process.env["GROQ_API_KEY"]!.trim() })(modelId.replace("groq/", "")),
      modelId,
    );
  }

  if (modelId.startsWith("openai/") && process.env["OPENAI_API_KEY"]?.trim()) {
    return requireLanguageModel(
      createOpenAICompatible({
        name: "openai",
        baseURL: "https://api.openai.com/v1",
        apiKey: process.env["OPENAI_API_KEY"]!.trim(),
      }).chatModel(modelId.replace("openai/", "")),
      modelId,
    );
  }

  if (modelId.startsWith("openrouter/") && process.env["OPENROUTER_API_KEY"]?.trim()) {
    return requireLanguageModel(
      createOpenAICompatible({
        name: "openrouter",
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: process.env["OPENROUTER_API_KEY"]!.trim(),
      }).chatModel(modelId.replace("openrouter/", "")),
      modelId,
    );
  }

  throw new Error(`AI_MODEL_UNAVAILABLE:${modelId}`);
}
