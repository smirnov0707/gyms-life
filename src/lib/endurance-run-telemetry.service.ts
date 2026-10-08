import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { normalizeRunTelemetry } from "./endurance-run-telemetry.engine";

export async function persistRunTelemetry(
  supabase: SupabaseClient<Database>,
  userId: string,
  value: unknown,
) {
  const t = normalizeRunTelemetry(value);
  const finishedAt = new Date(
    new Date(t.startedAt).getTime() + t.durationSeconds * 1000,
  ).toISOString();

  const { data: existing, error: lookupError } = await supabase
    .from("endurance_run_imports")
    .select("workout_session_id")
    .eq("user_id", userId)
    .eq("source", t.source)
    .eq("external_activity_id", t.externalActivityId)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) {
    return { status: "already_imported" as const, workoutSessionId: existing.workout_session_id };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: workoutSessionId, error } = await supabaseAdmin.rpc("record_endurance_run_import", {
    p_user_id: userId,
    p_source: t.source,
    p_environment: t.environment,
    p_external_activity_id: t.externalActivityId,
    p_started_at: t.startedAt,
    p_finished_at: finishedAt,
    p_duration_seconds: t.durationSeconds,
    p_distance_meters: t.distanceMeters,
    p_average_hr: t.averageHeartRateBpm,
    p_elevation_gain: t.elevationGainMeters,
    p_average_cadence: t.averageCadenceSpm,
    p_split_coverage: t.splitCoverage,
    p_splits: t.splits as unknown as Json,
  });
  if (error) throw error;
  return { status: "imported" as const, workoutSessionId, splitCoverage: t.splitCoverage };
}
