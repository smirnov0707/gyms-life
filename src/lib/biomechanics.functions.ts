import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createAiRouterProvider } from "./ai-gateway.server";
import { generateJson } from "./ai-json.server";
import { LANGUAGE_NAMES, SupportedLanguageSchema } from "./language.schema";

const BiomechanicsInput = z.object({
  image: z.string().min(10),
  exerciseName: z.string().default("squat"),
  lang: SupportedLanguageSchema.default("lt"),
});

const ExerciseFormAnalysisSuccessSchema = z.object({
  ok: z.literal(true),
  exerciseDetected: z.string().trim().min(1).max(120),
  score: z.coerce.number().finite().min(0).max(100),
  jointAngles: z.record(z.string(), z.string().trim().min(1).max(100)).default({}),
  strengths: z.array(z.string().trim().min(1).max(300)).max(8).default([]),
  corrections: z.array(z.string().trim().min(1).max(300)).max(8).default([]),
  injuryRisk: z.enum(["low", "medium", "high"]).default("low"),
  coachCue: z.string().trim().min(1).max(500),
});

const ExerciseFormAnalysisFailureSchema = z.object({
  ok: z.literal(false),
  reason: z.string().trim().min(1).max(500),
});

export const ExerciseFormAnalysisSchema = z.discriminatedUnion("ok", [
  ExerciseFormAnalysisSuccessSchema,
  ExerciseFormAnalysisFailureSchema,
]);

export type ExerciseFormAnalysis = z.infer<typeof ExerciseFormAnalysisSchema>;

function failedAnalysis(reason: string): ExerciseFormAnalysis {
  return { ok: false, reason };
}

export const analyzeExerciseForm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => BiomechanicsInput.parse(data))
  .handler(async ({ data, context }) => {
    const geminiKey = process.env["GEMINI_API_KEY"];
    if (!geminiKey) {
      return failedAnalysis("AI regos variklis nesukonfigūruotas.");
    }

    try {
      const langName = LANGUAGE_NAMES[data.lang];

      const prompt = `Tu esi profesionalus sporto biomechanikos kineziterapeutas ir treneris.
Išanalizuok šį pratimo atlikimo kadrą (${data.exerciseName}).

Įvertink:
1. Stuburo padėtį ir neutralumą.
2. Sąnarių kampus (klubai, keliai, pečiai).
3. Svorio / štangos trajektoriją ir stabilumą.

Atsakyk TIK TIKSLIU JSON:
{
  "ok": true,
  "exerciseDetected": "Pratimo pavadinimas",
  "score": 90,
  "jointAngles": {
    "kneeFlexion": "110° (Optimalus)",
    "torsoAngle": "45° (Geras neutralumas)"
  },
  "strengths": ["Geras gylis", "Stabili pėdų pozicija"],
  "corrections": ["Kelius stumti labiau į išorę ekscentrinėje fazėje"],
  "injuryRisk": "low",
  "coachCue": "Taiklus biomechaninis patarimas ${langName} kalba"
}`;

      const provider = createAiRouterProvider("biomechanics.functions");
      return await generateJson(provider("google/gemini-2.5-flash"), {
        userId: context.userId,
        system: prompt,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Išanalizuok šį pratimo atlikimo kadrą." },
              { type: "image", image: data.image },
            ],
          },
        ],
        schema: ExerciseFormAnalysisSchema,
        maxOutputTokens: 1_200,
      });
    } catch {
      return failedAnalysis("Biomechanikos klaida.");
    }
  });
