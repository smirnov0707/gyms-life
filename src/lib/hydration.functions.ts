import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculateHydrationTarget } from "./hydration.engine";
import { HydrationTargetSchema, type HydrationTarget } from "./hydration.schema";
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
