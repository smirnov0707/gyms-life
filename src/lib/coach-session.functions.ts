import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateOrchestratedJson } from "./ai-orchestrator.server";
import { LANGUAGE_NAMES, SupportedLanguageSchema, type SupportedLanguage } from "./language.schema";

export const WARMUP_SLUGS = ["arm-circles", "bodyweight-squats", "band-pull-aparts", "plank"];

const SmartWarmupInput = z.object({
  focus: z.string().trim().max(160).default(""),
  exercises: z.array(z.string().trim().min(1).max(120)).max(12).default([]),
  lang: SupportedLanguageSchema.default("lt"),
});

const SmartWarmupRecommendationSchema = z.object({
  headline: z.string().trim().min(1).max(200),
  minutes: z.coerce.number().int().min(3).max(20),
  drills: z
    .array(
      z.object({
        slug: z.string().trim().min(1).max(120),
        name: z.string().trim().min(1).max(160),
        dose: z.string().trim().min(1).max(80),
        focus: z.string().trim().min(1).max(160),
        why: z.string().trim().min(1).max(240),
      }),
    )
    .min(2)
    .max(6),
});

export type SmartWarmup = z.infer<typeof SmartWarmupRecommendationSchema> & {
  readiness: number | null;
};

function fallbackWarmup(lang: SupportedLanguage, readiness: number | null): SmartWarmup {
  const lithuanian = lang === "lt";
  return {
    headline: lithuanian ? "Dinaminis apšilimas" : "Dynamic warm-up",
    minutes: 6,
    readiness,
    drills: [
      {
        slug: "arm-circles",
        name: lithuanian ? "Rankų ratai" : "Arm circles",
        dose: "60s",
        focus: lithuanian ? "Pečiai ir mentės" : "Shoulders and scapulae",
        why: lithuanian
          ? "Aktyvina pečių juostą prieš apkrovą."
          : "Prepares the shoulder girdle for loading.",
      },
      {
        slug: "bodyweight-squats",
        name: lithuanian ? "Pritūpimai be svorio" : "Bodyweight squats",
        dose: "12 reps",
        focus: lithuanian ? "Klubai ir keliai" : "Hips and knees",
        why: lithuanian
          ? "Pakelia temperatūrą ir aktyvina apatinę kūno dalį."
          : "Raises temperature and activates the lower body.",
      },
      {
        slug: "plank",
        name: lithuanian ? "Lenta" : "Plank",
        dose: "30s",
        focus: lithuanian ? "Šerdis" : "Core",
        why: lithuanian
          ? "Suteikia liemens stabilumą pagrindiniams judesiams."
          : "Builds trunk stability for the main lifts.",
      },
    ],
  };
}

export const getSmartWarmup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => SmartWarmupInput.parse(input))
  .handler(async ({ data, context }): Promise<SmartWarmup> => {
    const { data: latestCheckin } = await context.supabase
      .from("daily_checkins")
      .select("readiness_score")
      .eq("user_id", context.userId)
      .order("checkin_on", { ascending: false })
      .limit(1)
      .maybeSingle();
    const readiness = latestCheckin?.readiness_score ?? null;
    const focus = data.focus || data.exercises.join(", ") || "full body";

    try {
      const recommendation = await generateOrchestratedJson({
        task: "coach.warmup",
        supabase: context.supabase,
        userId: context.userId,
        system:
          "You are a strength coach. Build conservative dynamic warm-ups. Do not diagnose or treat injuries.",
        prompt: `Write in ${LANGUAGE_NAMES[data.lang]}. Build a 3-6 drill warm-up for: ${focus}. Exercises: ${data.exercises.join(", ") || "not specified"}.`,
        schema: SmartWarmupRecommendationSchema,
        maxOutputTokens: 1200,
      });
      return { ...recommendation, readiness };
    } catch (error) {
      console.warn("Smart warm-up generation failed; using the deterministic fallback.", error);
      return fallbackWarmup(data.lang, readiness);
    }
  });

const SetAdviceInput = z.object({
  exerciseName: z.string(),
  currentSet: z.number(),
  targetReps: z.number(),
  actualReps: z.number(),
  rpe: z.number().min(1).max(10),
  lang: SupportedLanguageSchema.default("lt"),
});

const SetAdviceSchema = z.object({
  ok: z.literal(true),
  weightAdjustment: z.enum(["keep", "increase", "decrease"]),
  suggestedAdjustmentKg: z.coerce.number().finite().min(-100).max(100),
  recommendedRestSec: z.coerce.number().int().min(0).max(1_800),
  advice: z.string().trim().min(1).max(500),
});

export const getSetAdvice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => SetAdviceInput.parse(data))
  .handler(async ({ data, context }) => {
    const langName = LANGUAGE_NAMES[data.lang];

    const prompt = `Sportininkas atliko pratimą: "${data.exerciseName}".
Serija: #${data.currentSet}, Tikslas: ${data.targetReps} pakartojimai, Atliko: ${data.actualReps} pakartojimus, Subjektyvus nuovargis (RPE): ${data.rpe}/10.

Pateik momentinį, taiklų trenerio patarimą kitai serijai.
Atsakyk TIK TIKSLIU JSON:
{
  "ok": true,
  "weightAdjustment": "keep" | "increase" | "decrease",
  "suggestedAdjustmentKg": 0,
  "recommendedRestSec": 90,
  "advice": "Taiklus patarimas ${langName} kalba"
}`;

    try {
      return await generateOrchestratedJson({
        task: "coach.set-advice",
        supabase: context.supabase,
        userId: context.userId,
        system: "Atsakyk TIK griežtu JSON formatu.",
        prompt,
        schema: SetAdviceSchema,
      });
    } catch {
      return {
        ok: true,
        weightAdjustment: "keep",
        suggestedAdjustmentKg: 0,
        recommendedRestSec: 90,
        advice:
          data.lang === "lt"
            ? "Išlaikykite stabilią formą ir kontroliuokite judesį."
            : "Maintain form and control the tempo.",
      };
    }
  });

const DebriefInput = z.object({
  sessionDurationMin: z.number(),
  totalSetsCompleted: z.number(),
  avgRpe: z.number(),
  exercisesCompleted: z.array(z.string()),
  lang: SupportedLanguageSchema.default("lt"),
});

const SessionDebriefSchema = z.object({
  ok: z.literal(true),
  recoveryHours: z.coerce.number().finite().min(0).max(168),
  stimulusScore: z.coerce.number().finite().min(0).max(100),
  summary: z.string().trim().min(1).max(1_000),
  nutritionTip: z.string().trim().min(1).max(500),
});

export const getSessionDebrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => DebriefInput.parse(data))
  .handler(async ({ data, context }) => {
    const prompt = `Išanalizuok baigtos treniruotės duomenis:
Trukmė: ${data.sessionDurationMin} min, Viso serijų: ${data.totalSetsCompleted}, Vidutinis RPE: ${data.avgRpe}, Pratimai: ${data.exercisesCompleted.join(", ")}.

Atsakyk TIK JSON:
{
  "ok": true,
  "recoveryHours": 48,
  "stimulusScore": 92,
  "summary": "Treniruotės apibendrinimas",
  "nutritionTip": "Mitybos rekomendacija po treniruotės"
}`;

    const system = `Return strict JSON only. Write the summary and nutritionTip in ${LANGUAGE_NAMES[data.lang]}.`;

    try {
      return await generateOrchestratedJson({
        task: "coach.session-debrief",
        supabase: context.supabase,
        userId: context.userId,
        system,
        prompt,
        schema: SessionDebriefSchema,
      });
    } catch {
      return {
        ok: true,
        recoveryHours: 48,
        stimulusScore: 85,
        summary: data.lang === "lt" ? "Puikiai atlikta treniruotė." : "Great workout session.",
        nutritionTip:
          data.lang === "lt"
            ? "30-40g baltymų ir angliavandeniai atsistatymui."
            : "30-40g protein with carbs.",
      };
    }
  });
