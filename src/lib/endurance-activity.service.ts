import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { EnduranceActivitySchema, type EnduranceActivity } from "./endurance-activity.schema";
import { buildEnduranceTrainingCredit } from "./endurance-training-credit.engine";
import { matchCompletedRunToPlan } from "./endurance-session-matching.engine";
import { loadActiveRacePrep } from "./endurance-race-prep.service";

type Client = SupabaseClient<Database>;

export async function recordEnduranceActivity(
  supabase: Client,
  userId: string,
  input: unknown,
) {
  const activity = EnduranceActivitySchema.parse(input);
  const credit = buildEnduranceTrainingCredit(activity);
  if (credit.status !== "credited") throw new Error("Endurance activity could not be credited.");

  const finishedAt = new Date(
    new Date(activity.startedAt).getTime() + activity.durationSeconds * 1000,
  ).toISOString();

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
  if (activity.kind === "run") {
    try {
      const today = activity.startedAt.slice(0, 10);
      const prep = await loadActiveRacePrep(supabase, userId, today);
      if (prep.status === "active") {
        const remaining = prep.currentWeek.sessions.filter((_, index) => index >= prep.progress.matchedSessions);
        const match = matchCompletedRunToPlan(remaining, {
          distanceMeters: activity.distanceMeters,
          durationMinutes: activity.durationSeconds / 60,
          perceivedEffort: activity.perceivedEffort,
        });
        raceMatch = match.status === "no_match" ? match : {
          ...match,
          plannedIndex: match.plannedIndex + prep.progress.matchedSessions,
          intent: prep.currentWeek.sessions[match.plannedIndex + prep.progress.matchedSessions]?.intent ?? null,
        };
        if (raceMatch.status === "confident" && raceMatch.intent !== null) {
          const { error: matchError } = await supabase.from("workout_sessions").update({
            endurance_session_intent: raceMatch.intent,
            endurance_match_source: "system_confident",
            endurance_match_score: raceMatch.score,
          }).eq("id", data.id).eq("user_id", userId);
          if (matchError) throw matchError;
        }
      }
    } catch {
      // Race classification is enrichment. A successfully recorded run must
      // never be rolled back or reported as failed because optional race
      // preparation evidence was temporarily unavailable.
      raceMatch = null;
    }
  }

  return { session: data, activity: activity satisfies EnduranceActivity, credit, raceMatch };
}
