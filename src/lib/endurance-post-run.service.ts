import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { assessFatigueDecoupling } from "./endurance-fatigue-decoupling.engine";
import { buildPostRunBrief } from "./endurance-post-run.engine";
import { loadDigitalAthleteState } from "./digital-athlete.service";
import { dayBoundsInTimeZone, dayInTimeZone } from "./local-day";

export async function loadLatestPostRunBrief(supabase: SupabaseClient<Database>, userId: string) {
  const { loadPersistedProfileTimeZone } = await import("./user-context.server");
  const timeZone = await loadPersistedProfileTimeZone(supabase, userId);
  const now = new Date();
  const today = dayInTimeZone(now, timeZone);
  const bounds = dayBoundsInTimeZone(today, timeZone);

  const { data: run, error } = await supabase
    .from("workout_sessions")
    .select(
      "id,started_at,distance_meters,duration_seconds,endurance_session_intent,endurance_plan_session_key,endurance_match_source,endurance_match_score",
    )
    .eq("user_id", userId)
    .eq("activity_kind", "run")
    .not("finished_at", "is", null)
    .gte("started_at", bounds.start)
    .lt("started_at", bounds.end)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!run || run.distance_meters === null || run.duration_seconds === null) {
    return { status: "none" as const };
  }

  const { data: splits, error: splitError } = await supabase
    .from("endurance_run_splits")
    .select("split_index,distance_meters,duration_seconds,average_heart_rate_bpm,cadence_spm")
    .eq("user_id", userId)
    .eq("workout_session_id", run.id)
    .order("split_index");
  if (splitError) throw splitError;

  const fatigue = assessFatigueDecoupling(
    (splits ?? []).map((split) => ({
      index: split.split_index,
      distanceMeters: Number(split.distance_meters),
      durationSeconds: Number(split.duration_seconds),
      averageHeartRateBpm: split.average_heart_rate_bpm,
      cadenceSpm: split.cadence_spm === null ? null : Number(split.cadence_spm),
    })),
  );

  const athlete = await loadDigitalAthleteState(supabase, userId, now, timeZone);
  const score = athlete.currentDay.hasCompletedReadiness
    ? athlete.recovery.latestReadinessScore
    : null;
  const readinessBand =
    score === null ? "unknown" : score < 55 ? "low" : score < 80 ? "moderate" : "high";

  const match =
    run.endurance_session_intent &&
    run.endurance_plan_session_key &&
    run.endurance_match_score !== null
      ? {
          status: "confident" as const,
          plannedIndex: 0,
          plannedSessionKey: run.endurance_plan_session_key,
          score: Number(run.endurance_match_score),
          reason: "distance_and_effort_align" as const,
        }
      : null;

  return {
    status: "ready" as const,
    workoutSessionId: run.id,
    startedAt: run.started_at,
    brief: buildPostRunBrief({
      distanceMeters: Number(run.distance_meters),
      durationSeconds: Number(run.duration_seconds),
      match,
      fatigue,
      readinessBand,
    }),
    fatigue,
    matchSource: run.endurance_match_source,
    sessionIntent: run.endurance_session_intent,
  };
}
