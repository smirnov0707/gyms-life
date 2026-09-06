import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { LANGUAGE_NAMES, SupportedLanguageSchema } from "./language.schema";
import { calendarDayDifference, dayInTimeZone } from "./local-day";
import { loadPersistedProfileTimeZone } from "./user-context.server";

const Input = z.object({ lang: SupportedLanguageSchema.default("lt") });

/**
 * What the model is actually asked for: a judgement about each substance.
 *
 * `daysOn` used to be in here, with the prompt telling the model to work it
 * out from `created_at` versus today — arithmetic the server has both
 * operands for, delegated to a language model and then `.catch(0)`-ed into
 * "0 days" whenever the answer came back unparseable. It is computed below.
 *
 * `adherence` used to be here too: a 0-100 percentage, rendered with a
 * progress bar under the label "Adherence". Nothing in this app records
 * whether the athlete took a dose — the `supplements` table holds the stack,
 * not an intake log — so the prompt asked the model to estimate it from
 * training sessions and check-ins, which say nothing about swallowing a
 * capsule. It is gone rather than reworded.
 */
const AdviceSchema = z.object({
  summary: z.string(),
  items: z
    .array(
      z.object({
        name: z.string(),
        status: z.enum(["continue", "cycle_soon", "break_now", "reduce"]).catch("continue"),
        breakInDays: z.number().catch(0),
        breakLengthDays: z.number().catch(0),
        reason: z.string(),
      }),
    )
    .default([]),
  progress: z.array(z.string()).default([]),
});

/** The advice as the screen receives it: the model's judgement plus measured days. */
export type CycleAdviceItem = z.infer<typeof AdviceSchema>["items"][number] & {
  /** Null when the model named something that is not in the athlete's stack. */
  daysOn: number | null;
};

export type CycleAdvice = Omit<z.infer<typeof AdviceSchema>, "items"> & {
  items: CycleAdviceItem[];
};

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

    // The date the model is told is the athlete's, not the server's — and the
    // same zone dates the measured `daysOn` below.
    const timeZone = await (async () => {
      try {
        return await loadPersistedProfileTimeZone(supabase, userId);
      } catch {
        return "UTC";
      }
    })();
    const today = dayInTimeZone(new Date(), timeZone);

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
breakInDays = days from today until the break should start (0 if it should start now, 0 for "continue").
breakLengthDays = how long the break should last in days (0 for "continue").
reason = max 2 short sentences, specific to that substance (tolerance, receptor downregulation, absorption, liver/kidney load, blood test recommendation).
progress = 2-4 short bullet observations tying training volume, readiness and the supplement stack together.
summary = 2 sentences of overall guidance.`,
      prompt: `Active supplements: ${JSON.stringify(active)}
Recent workout sessions: ${JSON.stringify(sessions ?? [])}
Recent daily check-ins: ${JSON.stringify(checkins ?? [])}`,
      schema: AdviceSchema,
      maxOutputTokens: 4000,
    });

    // How long each supplement has been in the stack is a measurement, not a
    // judgement: the row's own `created_at` against the athlete's today. An
    // item the model named that matches no stored supplement gets null, and
    // the screen leaves the line out rather than showing a made-up count.
    const startedOn = new Map(
      active.map((supplement) => [
        supplement.name.trim().toLowerCase(),
        dayInTimeZone(new Date(supplement.created_at), timeZone),
      ]),
    );

    return {
      empty: false as const,
      advice: {
        ...advice,
        items: advice.items.map((item) => {
          const started = startedOn.get(item.name.trim().toLowerCase());
          return {
            ...item,
            daysOn:
              started === undefined ? null : Math.max(0, calendarDayDifference(started, today)),
          };
        }),
      },
    };
  });
