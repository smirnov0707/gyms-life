import { generateText, type ModelMessage } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { createAiModel, type AiModelId } from "./ai-gateway.server";
import { generateJson, normalizeAiError } from "./ai-json.server";
import { reserveAiRequest } from "./ai-quota.server";
import { buildUserContext, contextForAi } from "./user-context.server";

type AiContextScope = "none" | "personalized";

type AiTaskPolicy = {
  model: AiModelId;
  contextScope: AiContextScope;
  allowProviderFallback?: boolean;
};

/**
 * The sole model-routing policy for user-facing AI work. A feature declares a
 * task; it cannot select a provider or model itself.
 */
const AI_TASK_POLICIES = {
  "body-scan": {
    model: "google/gemini-3.1-flash-lite",
    contextScope: "none",
    allowProviderFallback: false,
  },
  "coach.ask": { model: "groq/llama-3.3-70b-versatile", contextScope: "personalized" },
  "coach.session-debrief": {
    model: "groq/llama-3.3-70b-versatile",
    contextScope: "personalized",
  },
  "coach.set-advice": { model: "groq/llama-3.3-70b-versatile", contextScope: "personalized" },
  "coach.warmup": { model: "google/gemini-2.5-flash", contextScope: "personalized" },
  "daily-brief": { model: "google/gemini-3.1-flash-lite", contextScope: "personalized" },
  "daily-readiness": { model: "google/gemini-3.1-flash-lite", contextScope: "personalized" },
  dineout: { model: "groq/llama-3.3-70b-versatile", contextScope: "personalized" },
  "exercise-filter": { model: "groq/llama-3.3-70b-versatile", contextScope: "none" },
  "exercise-suggestion": {
    model: "google/gemini-3.1-flash-lite",
    contextScope: "personalized",
  },
  "food-vision": {
    model: "google/gemini-2.5-flash",
    contextScope: "personalized",
    allowProviderFallback: false,
  },
  forecast: { model: "google/gemini-3.1-flash-lite", contextScope: "personalized" },
  "form-analysis": {
    model: "google/gemini-3.1-flash-lite",
    contextScope: "none",
    allowProviderFallback: false,
  },
  fridge: { model: "groq/llama-3.3-70b-versatile", contextScope: "personalized" },
  "ghost-coach": { model: "groq/llama-3.3-70b-versatile", contextScope: "personalized" },
  "meal-adaptation": { model: "google/gemini-3.1-flash-lite", contextScope: "personalized" },
  "meal-plan": { model: "google/gemini-3.1-flash-lite", contextScope: "personalized" },
  "meal-translation": { model: "google/gemini-3.1-flash-lite", contextScope: "none" },
  "medical-report": { model: "google/gemini-3.1-flash-lite", contextScope: "none" },
  micronutrients: { model: "google/gemini-3.1-flash-lite", contextScope: "personalized" },
  motivation: { model: "google/gemini-3.1-flash-lite", contextScope: "personalized" },
  "nutrition-analysis": {
    model: "google/gemini-3.1-flash-lite",
    contextScope: "personalized",
  },
  "plan-translation": { model: "google/gemini-3.1-flash-lite", contextScope: "none" },
  "supplement-cycle": {
    model: "google/gemini-3.1-flash-lite",
    contextScope: "personalized",
  },
  "supplement-vision": {
    model: "google/gemini-2.5-flash",
    contextScope: "none",
    allowProviderFallback: false,
  },
  "training-plan": { model: "google/gemini-2.5-flash", contextScope: "personalized" },
  "voice-log-structuring": {
    model: "groq/llama-3.3-70b-versatile",
    contextScope: "none",
  },
  "workout-request": { model: "google/gemini-2.5-flash", contextScope: "personalized" },
  "workout-structure": { model: "google/gemini-3.1-flash-lite", contextScope: "personalized" },
  biomechanics: {
    model: "google/gemini-2.5-flash",
    contextScope: "none",
    allowProviderFallback: false,
  },
} satisfies Record<string, AiTaskPolicy>;

export type AiTask = keyof typeof AI_TASK_POLICIES;

export function getAiTaskPolicy(task: AiTask): Readonly<AiTaskPolicy> {
  return AI_TASK_POLICIES[task];
}

type OrchestrationRequest = {
  task: AiTask;
  supabase?: SupabaseClient<Database>;
  userId: string;
};

type OrchestratedExecution = {
  model: ReturnType<typeof createAiModel>;
  contextPrompt: string;
};

const VoiceTranscriptionResponseSchema = z.object({ text: z.string().optional() });
const VOICE_TRANSCRIPTION_MODEL = "whisper-large-v3-turbo";

function contextInstruction(task: AiTask, context: string): string {
  return `GYMS.LIFE CENTRAL USER CONTEXT (source of truth; task: ${task}):\n${context}`;
}

function addContextToSystem(system: string | undefined, contextPrompt: string): string {
  return [system, contextPrompt].filter(Boolean).join("\n\n");
}

async function prepareOrchestratedExecution(
  request: OrchestrationRequest,
): Promise<OrchestratedExecution> {
  const policy = getAiTaskPolicy(request.task);
  let contextPrompt = "";
  if (policy.contextScope === "personalized") {
    const supabase = request.supabase;
    if (!supabase) {
      throw new Error(`AI task ${request.task} requires an authenticated user context.`);
    }
    contextPrompt = contextInstruction(
      request.task,
      contextForAi(await buildUserContext(supabase, request.userId)),
    );
  }

  return {
    model: createAiModel(policy.model, policy.allowProviderFallback),
    contextPrompt,
  };
}

/**
 * Single orchestration entry point: GYMS.LIFE owns context; specialist models
 * are replaceable workers. This module is deliberately provider-agnostic.
 */
export async function generateOrchestratedJson<T>(
  request: OrchestrationRequest & {
    prompt?: string;
    system?: string;
    messages?: ModelMessage[];
    schema: z.ZodType<T, unknown>;
    maxOutputTokens?: number;
  },
): Promise<T> {
  const execution = await prepareOrchestratedExecution(request);
  return generateJson(execution.model, {
    userId: request.userId,
    system: addContextToSystem(request.system, execution.contextPrompt),
    schema: request.schema,
    ...(request.prompt === undefined ? {} : { prompt: request.prompt }),
    ...(request.messages === undefined ? {} : { messages: request.messages }),
    ...(request.maxOutputTokens === undefined ? {} : { maxOutputTokens: request.maxOutputTokens }),
  });
}

export async function generateOrchestratedText(
  request: OrchestrationRequest & {
    prompt?: string;
    system?: string;
    messages?: ModelMessage[];
    temperature?: number;
    maxOutputTokens?: number;
  },
): Promise<string> {
  const execution = await prepareOrchestratedExecution(request);
  try {
    await reserveAiRequest(request.userId);
    const { text } = await generateText({
      model: execution.model,
      system: addContextToSystem(request.system, execution.contextPrompt),
      ...(request.messages ? { messages: request.messages } : { prompt: request.prompt ?? "" }),
      temperature: request.temperature ?? 0.2,
      maxOutputTokens: request.maxOutputTokens ?? 16000,
      maxRetries: 2,
    });
    return text;
  } catch (error) {
    throw normalizeAiError(error);
  }
}

/**
 * Voice is a specialist adapter, but still belongs to the central orchestration
 * boundary: it uses the same server-side quota and never exposes provider keys.
 */
export async function transcribeOrchestratedVoice({
  userId,
  audioBase64,
  mimeType,
  language,
}: {
  userId: string;
  audioBase64: string;
  mimeType: string;
  language: "lt" | "en";
}): Promise<string> {
  const groqKey = process.env["GROQ_API_KEY"];
  if (!groqKey) throw new Error("AI voice transcription is not configured.");

  const commaIndex = audioBase64.indexOf(",");
  const rawBase64 = commaIndex >= 0 ? audioBase64.slice(commaIndex + 1) : audioBase64;
  const audioBytes = Uint8Array.from(Buffer.from(rawBase64, "base64"));
  const formData = new FormData();
  formData.append("file", new Blob([audioBytes], { type: mimeType }), "workout-audio.webm");
  formData.append("model", VOICE_TRANSCRIPTION_MODEL);
  formData.append("language", language);
  formData.append("temperature", "0.0");

  await reserveAiRequest(userId);
  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${groqKey}` },
    body: formData,
  });
  if (!response.ok) {
    throw new Error("AI voice transcription failed.");
  }

  const parsed = VoiceTranscriptionResponseSchema.safeParse(await response.json());
  const transcription = parsed.success ? (parsed.data.text?.trim() ?? "") : "";
  if (!transcription) throw new Error("AI voice transcription returned no speech.");
  return transcription;
}
