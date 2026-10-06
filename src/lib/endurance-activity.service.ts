import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { EnduranceActivitySchema, type EnduranceActivity } from "./endurance-activity.schema";
import { buildEnduranceTrainingCredit } from "./endurance-training-credit.engine";
import { matchCompletedRunToPlan } from "./endurance-session-matching.engine";
import { loadActiveRacePrep } from "./endurance-race-prep.service";
import { dayInTimeZone } from "./local-day";

type Client = SupabaseClient<Database>;

export async function recordEnduranceActivity(supabase: Client, userId: string, input: unknown) {
  const activity = EnduranceActivitySchema.parse(input);
  const credit = buildEnduranceTrainingCredit(activity);
  if (credit.status !== "credited") throw new Error("Endurance activity could not be credited.");

  const startedMs = new Date(activity.startedAt).getTime();
  const finishedMs = startedMs + activity.durationSeconds * 1000;
  if (finishedMs > Date.now() + 5 * 60_000) {
    throw new Error("Completed endurance activity cannot finish in the future.");
  }
  const finishedAt = new Date(finishedMs).toISOString();

  const { data, error } = await supabase
    .from("workout_sessions")
    .insert({
      user_id: userId,
      started_at: activity.startedAt,
      finished_at: finishedAt,
      duration_seconds: activity.durationSeconds,
      title: activity.kind === "run" ? "Run" : activity.kind === "walk" ? "Walk" : "Hike",
      total_volume: 0,
      activity_kind: activity.kind,
      activity_environment: activity.environment,
      activity_source: activity.source,
      distance_meters: activity.distanceMeters,
      average_heart_rate_bpm: activity.averageHeartRateBpm,
      perceived_effort: activity.perceivedEffort,
      workout_snapshot: { enduranceCredit: credit },
    })
    .select("id, started_at, finished_at")
    .single();

  if (error) throw error;

  let raceMatch = null;
  let raceIntelligence = null;
  if (activity.kind === "run") {
    try {
      const { loadPersistedProfileTimeZone } = await import("./user-context.server");
      const timeZone = await loadPersistedProfileTimeZone(supabase, userId);
      const today = dayInTimeZone(new Date(activity.startedAt), timeZone);
      const prep = await loadActiveRacePrep(supabase, userId, today, timeZone);
      if (prep.status === "active") {
        const completedKeys = new Set(prep.completedSessionKeys);
        const remaining = prep.effectiveSessions.filter(
          (session) => session.sessionKey && !completedKeys.has(session.sessionKey),
        );
        const match = matchCompletedRunToPlan(remaining, {
          distanceMeters: activity.distanceMeters,
          durationMinutes: activity.durationSeconds / 60,
          perceivedEffort: activity.perceivedEffort,
        });
        const matchedSession =
          match.status === "no_match" ? null : (remaining[match.plannedIndex] ?? null);
        raceMatch =
          match.status === "no_match"
            ? match
            : {
                ...match,
                raceGoalId: prep.goalId,
                intent: matchedSession?.intent ?? null,
              };
        if (
          raceMatch.status === "confident" &&
          raceMatch.intent !== null &&
          matchedSession?.sessionKey
        ) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error: matchError } = await supabaseAdmin
            .from("workout_sessions")
            .update({
              endurance_race_goal_id: prep.goalId,
              endurance_plan_session_key: matchedSession.sessionKey,
              endurance_session_intent: raceMatch.intent,
              endurance_match_source: "system_confident",
              endurance_match_score: raceMatch.score,
            })
            .eq("id", data.id)
            .eq("user_id", userId);
          if (matchError) throw matchError;
          const { tryPersistCurrentEnduranceAdaptation } =
            await import("./endurance-adaptation-refresh.service");
          await tryPersistCurrentEnduranceAdaptation(supabase, userId, today, timeZone);
        }
        const refreshedPrep = await loadActiveRacePrep(supabase, userId, today, timeZone);
        raceIntelligence =
          refreshedPrep.status === "active"
            ? {
                goalId: refreshedPrep.goalId,
                decision: refreshedPrep.intelligence,
                readiness: refreshedPrep.readiness,
              }
            : null;
      }
    } catch {
      // Race classification is enrichment. A successfully recorded run must
      // never be rolled back or reported as failed because optional race
      // preparation evidence was temporarily unavailable.
      raceMatch = null;
    }
  }

  return {
    session: data,
    activity: activity satisfies EnduranceActivity,
    credit,
    raceMatch,
    raceIntelligence,
  };
}
