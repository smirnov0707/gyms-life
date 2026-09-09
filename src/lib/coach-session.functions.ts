import { loadPersistedProfileTimeZone } from "./user-context.server";
import { dayInTimeZone } from "./local-day";
import { rethrowSafeAiError } from "./ai-error";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateOrchestratedJson } from "./ai-orchestrator.server";
import { LANGUAGE_NAMES, SupportedLanguageSchema } from "./language.schema";

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
        slug: z.enum(["arm-circles", "bodyweight-squats", "band-pull-aparts", "plank"]),
        name: z.string().trim().min(1).max(160),
        dose: z.string().trim().min(1).max(80),
        focus: z.string().trim().min(1).max(160),
        why: z.string().trim().min(1).max(240),
      }),
    )
    .min(2)
    .max(4)
    .refine(
      (drills) => new Set(drills.map((drill) => drill.slug)).size === drills.length,
      "Duplicate warm-up exercise",
    ),
});

export type SmartWarmup = z.infer<typeof SmartWarmupRecommendationSchema> & {
  readiness: number | null;
};

export const getSmartWarmup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => SmartWarmupInput.parse(input))
  .handler(async ({ data, context }): Promise<SmartWarmup> => {
    const timeZone = await loadPersistedProfileTimeZone(context.supabase, context.userId);
    const { data: latestCheckin, error: checkinError } = await context.supabase
      .from("daily_checkins")
      .select("readiness_score")
      .eq("user_id", context.userId)
      .eq("checkin_on", dayInTimeZone(new Date(), timeZone))
      .limit(1)
      .maybeSingle();
    if (checkinError) throw new Error("AI_CONTEXT_UNAVAILABLE");
    const readiness = latestCheckin?.readiness_score ?? null;
    const focus = data.focus || data.exercises.join(", ") || "full body";

    try {
      const recommendation = await generateOrchestratedJson({
        task: "coach.warmup",
        supabase: context.supabase,
        userId: context.userId,
        system:
          "You are a strength coach. Build conservative dynamic warm-ups. Do not diagnose or treat injuries.",
        prompt: `Write in ${LANGUAGE_NAMES[data.lang]}. Use only these demonstrated exercise slugs: ${WARMUP_SLUGS.join(", ")}. Build a 2-4 drill warm-up for: ${focus}. Exercises: ${data.exercises.join(", ") || "not specified"}.`,
        schema: SmartWarmupRecommendationSchema,
        maxOutputTokens: 1200,
      });
      return { ...recommendation, readiness };
    } catch (error) {
      rethrowSafeAiError(error);
      throw new Error("AI_INVALID_RESPONSE");
    }
  });
