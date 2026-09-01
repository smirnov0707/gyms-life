import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateJson } from "./ai-json.server";
import { askFastTextAi, createAiRouterProvider } from "./ai-gateway.server";

export const WARMUP_SLUGS = ["arm-circles", "bodyweight-squats", "band-pull-aparts", "plank"];

const SmartWarmupInput = z.object({
  focus: z.string().trim().max(160).default(""),
  exercises: z.array(z.string().trim().min(1).max(120)).max(12).default([]),
  lang: z.enum(["lt", "en", "ru", "uk", "pl", "de", "es", "fr"]).default("lt"),
});

const SmartWarmupRecommendationSchema = z.object({
  headline: z.string().trim().min(1).max(200),
  minutes: z.coerce.number().int().min(3).max(20),
  drills: z.array(z.object({
    slug: z.string().trim().min(1).max(120),
    name: z.string().trim().min(1).max(160),
    dose: z.string().trim().min(1).max(80),
    focus: z.string().trim().min(1).max(160),
    why: z.string().trim().min(1).max(240),
  })).min(2).max(6),
});

export type SmartWarmup = z.infer<typeof SmartWarmupRecommendationSchema> & { readiness: number | null };

function fallbackWarmup(lang: string, readiness: number | null): SmartWarmup {
  const lithuanian = lang === "lt";
  return {
    headline: lithuanian ? "Dinaminis apšilimas" : "Dynamic warm-up",
    minutes: 6,
    readiness,
    drills: [
      { slug: "arm-circles", name: lithuanian ? "Rankų ratai" : "Arm circles", dose: "60s", focus: lithuanian ? "Pečiai ir mentės" : "Shoulders and scapulae", why: lithuanian ? "Aktyvina pečių juostą prieš apkrovą." : "Prepares the shoulder girdle for loading." },
      { slug: "bodyweight-squats", name: lithuanian ? "Pritūpimai be svorio" : "Bodyweight squats", dose: "12 reps", focus: lithuanian ? "Klubai ir keliai" : "Hips and knees", why: lithuanian ? "Pakelia temperatūrą ir aktyvina apatinę kūno dalį." : "Raises temperature and activates the lower body." },
      { slug: "plank", name: lithuanian ? "Lenta" : "Plank", dose: "30s", focus: lithuanian ? "Šerdis" : "Core", why: lithuanian ? "Suteikia liemens stabilumą pagrindiniams judesiams." : "Builds trunk stability for the main lifts." },
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
      const provider = createAiRouterProvider("coach-session.functions");
      const recommendation = await generateJson(provider("google/gemini-2.5-flash"), {
        system: "You are a strength coach. Build conservative dynamic warm-ups. Do not diagnose or treat injuries.",
        prompt: `Write in ${data.lang}. Build a 3-6 drill warm-up for: ${focus}. Exercises: ${data.exercises.join(", ") || "not specified"}.`,
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
  lang: z.string().default("lt"),
});

export const getSetAdvice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => SetAdviceInput.parse(data))
  .handler(async ({ data }) => {
    const langName = data.lang === "lt" ? "lietuvių" : "anglų";
    
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
      const raw = await askFastTextAi({
        messages: [
          { role: "system", content: "Atsakyk TIK griežtu JSON formatu." },
          { role: "user", content: prompt },
        ],
        jsonMode: true,
        temperature: 0.2,
      });

      return JSON.parse(raw.replace(/```json/g, "").replace(/```/g, "").trim());
    } catch (err: any) {
      return {
        ok: true,
        weightAdjustment: "keep",
        suggestedAdjustmentKg: 0,
        recommendedRestSec: 90,
        advice: data.lang === "lt" ? "Išlaikykite stabilią formą ir kontroliuokite judesį." : "Maintain form and control the tempo.",
      };
    }
  });

const DebriefInput = z.object({
  sessionDurationMin: z.number(),
  totalSetsCompleted: z.number(),
  avgRpe: z.number(),
  exercisesCompleted: z.array(z.string()),
  lang: z.string().default("lt"),
});

export const getSessionDebrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => DebriefInput.parse(data))
  .handler(async ({ data }) => {
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

    try {
      const raw = await askFastTextAi({
        messages: [
          { role: "system", content: "Atsakyk TIK griežtu JSON formatu." },
          { role: "user", content: prompt },
        ],
        jsonMode: true,
        temperature: 0.2,
      });

      return JSON.parse(raw.replace(/```json/g, "").replace(/```/g, "").trim());
    } catch (err: any) {
      return {
        ok: true,
        recoveryHours: 48,
        stimulusScore: 85,
        summary: data.lang === "lt" ? "Puikiai atlikta treniruotė." : "Great workout session.",
        nutritionTip: data.lang === "lt" ? "30-40g baltymų ir angliavandeniai atsistatymui." : "30-40g protein with carbs.",
      };
    }
  });
