import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { LANGUAGE_NAMES, SupportedLanguageSchema } from "./language.schema";
import { dayInTimeZone } from "./local-day";
import { loadPersistedProfileTimeZone } from "./user-context.server";

const Input = z.object({ lang: SupportedLanguageSchema.default("lt") });

const AdviceSchema = z.object({
  summary: z.string(),
  adherence: z.number(),
  items: z
    .array(
      z.object({
        name: z.string(),
        status: z.enum(["continue", "cycle_soon", "break_now", "reduce"]).catch("continue"),
        daysOn: z.number().catch(0),
        breakInDays: z.number().catch(0),
        breakLengthDays: z.number().catch(0),
        reason: z.string(),
      }),
    )
    .default([]),
  progress: z.array(z.string()).default([]),
});

export type CycleAdvice = z.infer<typeof AdviceSchema>;

export const analyzeSupplementCycles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const since = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();

    const [{ data: supps }, { data: sessions }, { data: checkins }] = await Promise.all([
      supabase
        .from("supplements")
        .select(
          "name, dose, category, times_per_day, with_food, preferred_time, is_active, created_at",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
      supabase
        .from("workout_sessions")
        .select("started_at, total_volume, feeling")
        .eq("user_id", userId)
        .gte("started_at", since)
        .order("started_at", { ascending: false })
        .limit(40),
      supabase
        .from("daily_checkins")
        .select("checkin_on, readiness_score, sleep_hours, energy, soreness, stress")
        .eq("user_id", userId)
        .gte("checkin_on", since.slice(0, 10))
        .order("checkin_on", { ascending: false })
        .limit(40),
    ]);

    const active = (supps ?? []).filter((s) => s.is_active);
    if (active.length === 0) {
      return { empty: true as const };
    }

    const { generateOrchestratedJson } = await import("./ai-orchestrator.server");
    const language = LANGUAGE_NAMES[data.lang];

    // The date the model is told is the athlete's, not the server's.
    const today = await (async () => {
      try {
        return dayInTimeZone(new Date(), await loadPersistedProfileTimeZone(supabase, userId));
      } catch {
        return dayInTimeZone(new Date(), "UTC");
      }
    })();

    const advice = await generateOrchestratedJson({
      task: "supplement-cycle",
      supabase,
      userId,
      system: `You are a sports-nutrition specialist planning supplement cycling for one athlete.
Today is ${today}. Answer entirely in ${language}.
For EVERY active supplement decide, from evidence-based practice, whether it needs cycling:
- "continue" = safe to take year-round (e.g. creatine, protein, vitamin D at sane doses, omega-3),
- "cycle_soon" = it will need a washout period soon,
- "break_now" = it has been taken long enough and a break is due,
- "reduce" = dose or frequency is too high.
daysOn = how many days the athlete has been taking it (use created_at vs today).
breakInDays = days from today until the break should start (0 if it should start now, 0 for "continue").
breakLengthDays = how long the break should last in days (0 for "continue").
reason = max 2 short sentences, specific to that substance (tolerance, receptor downregulation, absorption, liver/kidney load, blood test recommendation).
adherence = 0-100 estimate of how consistent the athlete looks based on their training and check-in history.
progress = 2-4 short bullet observations tying training volume, readiness and the supplement stack together.
summary = 2 sentences of overall guidance.`,
      prompt: `Active supplements: ${JSON.stringify(active)}
Recent workout sessions: ${JSON.stringify(sessions ?? [])}
Recent daily check-ins: ${JSON.stringify(checkins ?? [])}`,
      schema: AdviceSchema,
      maxOutputTokens: 4000,
    });

    return { empty: false as const, advice };
  });
