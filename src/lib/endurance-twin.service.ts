import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildEnduranceTwinSignals } from "./endurance-twin.engine";
import { assessAerobicEfficiencyTrend } from "./endurance-twin-trend.engine";
export async function loadEnduranceTwinProfile(supabase: SupabaseClient<Database>, userId: string) {
  const { data: sessions, error } = await supabase
    .from("workout_sessions")
    .select("id,started_at")
    .eq("user_id", userId)
    .eq("activity_kind", "run")
    .not("finished_at", "is", null)
    .order("started_at", { ascending: false })
    .limit(12);
  if (error) throw error;
  const snapshots = [] as Array<{
    day: string;
    aerobicDrift: number | null;
    cadenceStability: number | null;
    paceStability: number | null;
  }>;
  let latestSignals: ReturnType<typeof buildEnduranceTwinSignals> = [];
  for (const session of sessions ?? []) {
    const { data: splits, error: splitError } = await supabase
      .from("endurance_run_splits")
      .select("split_index,distance_meters,duration_seconds,average_heart_rate_bpm,cadence_spm")
      .eq("user_id", userId)
      .eq("workout_session_id", session.id)
      .order("split_index");
    if (splitError) throw splitError;
    const normalized = (splits ?? []).map((x) => ({
      index: x.split_index,
      distanceMeters: Number(x.distance_meters),
      durationSeconds: Number(x.duration_seconds),
      averageHeartRateBpm: x.average_heart_rate_bpm,
      cadenceSpm: x.cadence_spm === null ? null : Number(x.cadence_spm),
    }));
    const signals = buildEnduranceTwinSignals(normalized);
    if (latestSignals.length === 0 && signals.some((x) => x.status === "measured"))
      latestSignals = signals;
    snapshots.push({
      day: session.started_at.slice(0, 10),
      aerobicDrift: signals.find((x) => x.key === "aerobic_drift")?.value ?? null,
      cadenceStability: signals.find((x) => x.key === "cadence_stability")?.value ?? null,
      paceStability: signals.find((x) => x.key === "split_pace_stability")?.value ?? null,
    });
  }
  const { loadPersistedProfileTimeZone } = await import("./user-context.server");
  const { dayInTimeZone } = await import("./local-day");
  const { loadActiveRacePrep } = await import("./endurance-race-prep.service");
  const timeZone = await loadPersistedProfileTimeZone(supabase, userId);
  const today = dayInTimeZone(new Date(), timeZone);
  const racePrep = await loadActiveRacePrep(supabase, userId, today, timeZone);
  const raceIntelligence =
    racePrep.status === "active"
      ? {
          goalId: racePrep.goalId,
          raceDistance: racePrep.raceDistance,
          daysToRace: racePrep.daysToRace,
          readiness: racePrep.readiness,
          decision: racePrep.intelligence,
          adaptationLesson: racePrep.adaptationLesson,
        }
      : null;
  return {
    provenance: "derived" as const,
    latestSignals,
    aerobicEfficiencyTrend: assessAerobicEfficiencyTrend(snapshots),
    raceIntelligence,
  };
}
