import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateOrchestratedJson, transcribeOrchestratedVoice } from "./ai-orchestrator.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SupportedLanguageSchema } from "./language.schema";

const VoiceLogInput = z.object({
  audioBase64: z.string().min(10).max(20_000_000),
  mimeType: z
    .string()
    .regex(/^audio\/(?:webm|mp4|mpeg|wav|ogg)(?:;[\w=-]+)?$/i, "Unsupported audio format.")
    .default("audio/webm"),
  lang: SupportedLanguageSchema.default("lt"),
});

const VoiceWorkoutSetSchema = z.object({
  exerciseName: z.string().trim().min(1).max(160),
  weightKg: z.coerce.number().finite().min(0).max(1_000),
  reps: z.coerce.number().int().min(1).max(1_000),
  rpe: z.coerce.number().finite().min(0).max(10),
  suggestedRestSeconds: z.coerce.number().int().min(0).max(1_800),
  coachFeedback: z.string().trim().min(1).max(500),
});

const VoiceLogSuccessSchema = z.object({
  ok: z.literal(true),
  transcription: z.string().trim().min(1).max(2_000),
  data: VoiceWorkoutSetSchema,
});

const VoiceLogFailureSchema = z.object({
  ok: z.literal(false),
  reason: z.string().trim().min(1).max(500),
});

export const VoiceLogResultSchema = z.discriminatedUnion("ok", [
  VoiceLogSuccessSchema,
  VoiceLogFailureSchema,
]);

export type VoiceLogResult = z.infer<typeof VoiceLogResultSchema>;

function failedVoiceLog(reason: string): VoiceLogResult {
  return { ok: false, reason };
}

export const parseVoiceWorkoutLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => VoiceLogInput.parse(data))
  .handler(async ({ data, context }) => {
    try {
      const transcription = await transcribeOrchestratedVoice({
        userId: context.userId,
        audioBase64: data.audioBase64,
        mimeType: data.mimeType,
        language: data.lang === "lt" ? "lt" : "en",
      });

      const prompt = `Sportininkas salėje ištarė šį sakinį apie atliktą seriją: "${transcription}".

Ištrauk šiuos duomenis ir grąžink TIK JSON formatu:
{
  "exerciseName": "Taisyklingas pratimo pavadinimas",
  "weightKg": 100,
  "reps": 8,
  "rpe": 8,
  "suggestedRestSeconds": 90,
  "coachFeedback": "Trumpas 1 sakinio įvertinimas"
}`;

      const parsedSet = await generateOrchestratedJson({
        task: "voice-log-structuring",
        supabase: context.supabase,
        userId: context.userId,
        system: "Atsakyk TIK JSON formatu.",
        prompt,
        schema: VoiceWorkoutSetSchema,
      });

      return VoiceLogSuccessSchema.parse({
        ok: true,
        transcription,
        data: parsedSet,
      });
    } catch (error: unknown) {
      console.error("Voice parse error:", error);
      return failedVoiceLog("Balso apdorojimo klaida.");
    }
  });
