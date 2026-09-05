import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { calculateHydrationTarget } from "./hydration.engine";
import {
  HydrationIntakeSchema,
  HydrationTargetSchema,
  type HydrationIntake,
  type HydrationTarget,
} from "./hydration.schema";
import { dayBoundsInTimeZone, dayInTimeZone } from "./local-day";

/**
 * The I/O half of hydration: gathers today's evidence and hands it to the
 * pure engine. Kept here rather than in the server functions so the coach
 * context and the widget compute the same target from the same reads
 * instead of growing two versions of it.
 */
export async function loadHydrationTarget(
  supabase: SupabaseClient<Database>,
  userId: string,
  timeZone = "UTC",
  now = new Date(),
): Promise<HydrationTarget> {
  const localDay = dayInTimeZone(now, timeZone);
  // The athlete's day, not a UTC one: treating the local date as a UTC
  // midnight would drop a session trained after midnight local time.
  const { start: dayStart, end: dayEnd } = dayBoundsInTimeZone(localDay, timeZone);

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
      .gte("started_at", dayStart)
      .lt("started_at", dayEnd),
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

  // A day with no meals logged is not a zero-protein day, it is a day we know
  // nothing about — the difference decides whether a protein allowance is
  // added at all or the input is reported as missing.
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
}

/** Today's intake so far, from the athlete's own rows. */
export async function loadHydrationIntake(
  supabase: SupabaseClient<Database>,
  userId: string,
  timeZone = "UTC",
  now = new Date(),
): Promise<HydrationIntake> {
  const localDay = dayInTimeZone(now, timeZone);

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
}
