import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { askFastTextAi } from "./ai-gateway.server";
import { parseAiJson } from "./ai-json.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SupportedLanguageSchema } from "./language.schema";

const VoiceLogInput = z.object({
  audioBase64: z.string().min(10),
  mimeType: z.string().default("audio/webm"),
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

const WhisperResponseSchema = z.object({ text: z.string().optional() });

function failedVoiceLog(reason: string): VoiceLogResult {
  return { ok: false, reason };
}

export const parseVoiceWorkoutLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => VoiceLogInput.parse(data))
  .handler(async ({ data, context }) => {
    const groqKey = process.env["GROQ_API_KEY"];
    if (!groqKey) {
      return failedVoiceLog("Balso apdorojimo variklis nesukonfigūruotas.");
    }

    try {
      // 1. Dekoduojame audio buferį Whisper modeliui
      const commaIndex = data.audioBase64.indexOf(",");
      const rawBase64 = commaIndex >= 0 ? data.audioBase64.slice(commaIndex + 1) : data.audioBase64;
      const audioBytes = Uint8Array.from(Buffer.from(rawBase64, "base64"));
      const blob = new Blob([audioBytes], { type: data.mimeType });

      const formData = new FormData();
      formData.append("file", blob, "workout-audio.webm");
      formData.append("model", "whisper-large-v3-turbo");
      formData.append("language", data.lang === "lt" ? "lt" : "en");
      formData.append("temperature", "0.0");

      const whisperRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqKey}`,
        },
        body: formData,
      });

      if (!whisperRes.ok) {
        const err = await whisperRes.text();
        console.error("Groq Whisper error:", err);
        return failedVoiceLog("Nepavyko atpažinti balso įrašo.");
      }

      const whisperData = WhisperResponseSchema.safeParse(await whisperRes.json());
      const transcription = whisperData.success ? whisperData.data.text?.trim() || "" : "";

      if (!transcription) {
        return failedVoiceLog("Balso įraše neaptikta kalba.");
      }

      // 2. Struktūruojame tekstą į atskirus duomenų laukus per GPT-OSS 120B
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

      const aiParsed = await askFastTextAi({
        userId: context.userId,
        messages: [
          { role: "system", content: "Atsakyk TIK JSON formatu." },
          { role: "user", content: prompt },
        ],
        jsonMode: true,
        temperature: 0.1,
      });

      return VoiceLogSuccessSchema.parse({
        ok: true,
        transcription,
        data: parseAiJson(aiParsed, VoiceWorkoutSetSchema),
      });
    } catch (error: unknown) {
      console.error("Voice parse error:", error);
      return failedVoiceLog("Balso apdorojimo klaida.");
    }
  });
