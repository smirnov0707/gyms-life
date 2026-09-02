import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

const groqClient = createGroq({
  apiKey: process.env["GROQ_API_KEY"] ?? "",
});

const googleClient = createGoogleGenerativeAI({
  apiKey: process.env["GEMINI_API_KEY"] ?? "",
});

export type AiModelId =
  "google/gemini-2.5-flash" | "google/gemini-3.1-flash-lite" | "groq/llama-3.3-70b-versatile";

export function isAiConfigured(): boolean {
  return Boolean(process.env["GROQ_API_KEY"] || process.env["GEMINI_API_KEY"]);
}

/**
 * Provider adapter only. Business modules must receive models through the
 * GYMS.LIFE orchestrator so task policy and fallbacks stay centrally owned.
 */
export function createAiModel(modelId: AiModelId, allowProviderFallback = true): LanguageModel {
  if (modelId.startsWith("google/") && process.env["GEMINI_API_KEY"]) {
    return googleClient(modelId.replace("google/", ""));
  }

  if (allowProviderFallback && process.env["GROQ_API_KEY"]) {
    return groqClient("llama-3.3-70b-versatile");
  }

  if (allowProviderFallback && process.env["GEMINI_API_KEY"]) {
    return googleClient("gemini-2.5-flash");
  }

  throw new Error("AI is not configured for the requested task.");
}
