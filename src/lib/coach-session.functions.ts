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
