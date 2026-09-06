import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  buildLiveSignals,
  type BodyMetricRow,
  type HealthSampleRow,
  type LiveSignal,
} from "./live-signals.engine";

/**
 * Reads the athlete's own recent measurements for the signal rail.
 *
 * Both queries are windowed rather than limited to the newest row, because a
 * change needs the reading before the current one and a watch does not write
 * every field every day.
 */
const WINDOW_DAYS = 45;

function windowStart(today: string): string {
  const start = Date.parse(`${today}T00:00:00Z`) - WINDOW_DAYS * 86_400_000;
  return new Date(start).toISOString().slice(0, 10);
}

export async function loadLiveSignals(
  supabase: SupabaseClient<Database>,
  userId: string,
  today: string,
): Promise<LiveSignal[]> {
  const from = windowStart(today);
  const [healthRes, bodyRes] = await Promise.all([
    supabase
      .from("health_samples")
      .select("sample_on, source, resting_hr, hrv_ms, sleep_hours, steps, active_kcal")
      .eq("user_id", userId)
      .gte("sample_on", from)
      .order("sample_on", { ascending: false })
      .limit(WINDOW_DAYS * 2),
    supabase
      .from("body_metrics")
      .select("measured_on, weight_kg, body_fat")
      .eq("user_id", userId)
      .gte("measured_on", from)
      .order("measured_on", { ascending: false })
      .limit(WINDOW_DAYS * 2),
  ]);

  // A failed query is passed through as null, not as an empty list. The two
  // render identically unless the difference survives this far, and "no watch
  // has ever sent anything" is a very different thing to tell an athlete than
  // "we could not read your watch data".
  return buildLiveSignals({
    health: healthRes.error ? null : ((healthRes.data ?? []) as HealthSampleRow[]),
    body: bodyRes.error ? null : ((bodyRes.data ?? []) as BodyMetricRow[]),
    today,
  });
}
