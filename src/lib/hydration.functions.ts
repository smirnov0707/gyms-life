import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculateHydrationTarget } from "./hydration.engine";
import {
  HYDRATION_MAX_ENTRY_ML,
  HydrationIntakeSchema,
  HydrationTargetSchema,
  type HydrationIntake,
  type HydrationTarget,
} from "./hydration.schema";
import { IanaTimeZoneSchema, dayInTimeZone } from "./local-day";

/**
 * Reads today's real evidence and hands it to the pure engine.
 *
 * Body mass comes from the latest logged measurement in preference to the
 * onboarding figure in `profiles`: the target should track the body the
 * athlete has now, not the one they described when they signed up.
 */
export const getHydrationTarget = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => IanaTimeZoneSchema.optional().parse(input ?? undefined))
  .handler(async ({ data, context }): Promise<HydrationTarget> => {
    const { supabase, userId } = context;
    const timeZone = data ?? "UTC";
    const localDay = dayInTimeZone(new Date(), timeZone);
    const dayStart = new Date(`${localDay}T00:00:00.000Z`).toISOString();

    const [measured, profile, sessions, nutrition, supplements] = await Promise.all([
      supabase
        .from("body_metrics")
        .select("weight_kg, measured_on")
        .eq("user_id", userId)
        .not("weight_kg", "is", null)
        .order("measured_on", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("profiles").select("weight_kg").eq("id", userId).maybeSingle(),
      supabase
        .from("workout_sessions")
        .select("duration_seconds")
        .eq("user_id", userId)
        .not("finished_at", "is", null)
        .gte("started_at", dayStart),
      supabase
        .from("nutrition_logs")
        .select("protein")
        .eq("user_id", userId)
        .eq("logged_on", localDay),
      supabase.from("supplements").select("category").eq("user_id", userId).eq("is_active", true),
    ]);

    const bodyWeightKg =
      measured.data?.weight_kg != null
        ? Number(measured.data.weight_kg)
        : profile.data?.weight_kg != null
          ? Number(profile.data.weight_kg)
          : null;

    const trainingMinutesToday = (sessions.data ?? []).reduce(
      (sum, session) => sum + Math.max(0, Number(session.duration_seconds ?? 0)) / 60,
      0,
    );

    // A day with no meals logged is not a zero-protein day, it is a day we
    // know nothing about — the difference decides whether the engine adds a
    // protein allowance or reports the input as missing.
    const proteinGramsToday =
      nutrition.data && nutrition.data.length > 0
        ? nutrition.data.reduce((sum, row) => sum + Number(row.protein ?? 0), 0)
        : null;

    return HydrationTargetSchema.parse(
      calculateHydrationTarget({
        bodyWeightKg: bodyWeightKg !== null && bodyWeightKg > 0 ? bodyWeightKg : null,
        trainingMinutesToday,
        proteinGramsToday,
        supplementCategories: (supplements.data ?? []).map((row) => String(row.category)),
      }),
    );
  });

/** Today's intake so far, from the athlete's own rows. */
export const getHydrationIntake = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => IanaTimeZoneSchema.optional().parse(input ?? undefined))
  .handler(async ({ data, context }): Promise<HydrationIntake> => {
    const { supabase, userId } = context;
    const localDay = dayInTimeZone(new Date(), data ?? "UTC");

    const { data: rows, error } = await supabase
      .from("hydration_logs")
      .select("id, amount_ml, consumed_at")
      .eq("user_id", userId)
      .eq("logged_on", localDay)
      .order("consumed_at", { ascending: true });

    if (error) throw new Error("Hydration lookup failed: " + error.message);

    const entries = (rows ?? []).map((row) => ({
      id: row.id,
      amountMl: Number(row.amount_ml),
      consumedAt: row.consumed_at,
    }));

    return HydrationIntakeSchema.parse({
      loggedOn: localDay,
      totalMl: entries.reduce((sum, entry) => sum + entry.amountMl, 0),
      entries,
    });
  });

const LogHydrationInput = z
  .object({
    amountMl: z.number().int().positive().max(HYDRATION_MAX_ENTRY_ML),
    timeZone: IanaTimeZoneSchema.optional(),
  })
  .strict();

/** Records one drink. Returns the day's new total so the UI never guesses. */
export const logHydration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => LogHydrationInput.parse(input))
  .handler(async ({ data, context }): Promise<HydrationIntake> => {
    const { supabase, userId } = context;
    const localDay = dayInTimeZone(new Date(), data.timeZone ?? "UTC");

    const { error } = await supabase.from("hydration_logs").insert({
      user_id: userId,
      logged_on: localDay,
      amount_ml: data.amountMl,
    });
    if (error) throw new Error("Could not save hydration: " + error.message);

    return getHydrationIntake({ data: data.timeZone });
  });

/** Clears today's entries — the reset the widget has always offered. */
export const clearHydrationToday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => IanaTimeZoneSchema.optional().parse(input ?? undefined))
  .handler(async ({ data, context }): Promise<HydrationIntake> => {
    const { supabase, userId } = context;
    const localDay = dayInTimeZone(new Date(), data ?? "UTC");

    const { error } = await supabase
      .from("hydration_logs")
      .delete()
      .eq("user_id", userId)
      .eq("logged_on", localDay);
    if (error) throw new Error("Could not clear hydration: " + error.message);

    return getHydrationIntake({ data });
  });
