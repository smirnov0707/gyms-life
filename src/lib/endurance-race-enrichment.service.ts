import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { EnduranceActivitySchema } from "./endurance-activity.schema";
import type { EndurancePlanSession } from "./endurance-race-goal.schema";
import { loadActiveRacePrep } from "./endurance-race-prep.service";
import {
  matchCompletedRunToPlan,
  type RaceSessionMatch,
} from "./endurance-session-matching.engine";
import {
  RetryEnduranceRaceEnrichmentSchema,
  type EnduranceEnrichmentStage,
  type EnduranceRaceEnrichmentState,
} from "./endurance-race-enrichment.schema";
import { dayInTimeZone } from "./local-day";

type Client = SupabaseClient<Database>;
type ActivePrep = Extract<Awaited<ReturnType<typeof loadActiveRacePrep>>, { status: "active" }>;
type EnrichedMatch =
  | Extract<RaceSessionMatch, { status: "no_match" }>
  | (Exclude<RaceSessionMatch, { status: "no_match" }> & {
      raceGoalId: string;
      intent: EndurancePlanSession["intent"] | null;
    });

export type EnduranceRaceEnrichmentResult = {
  raceMatch: EnrichedMatch | null;
  raceIntelligence: {
    goalId: string;
    decision: ActivePrep["intelligence"];
    readiness: ActivePrep["readiness"];
  } | null;
  raceEnrichment: EnduranceRaceEnrichmentState;
};

/** Bounded diagnostic codes only: never log raw errors, user IDs or health evidence. */
export function unavailableEnduranceEnrichment(
  stage: EnduranceEnrichmentStage,
  linked = false,
): EnduranceRaceEnrichmentResult {
  console.warn(`[Endurance] RACE_ENRICHMENT_${stage.toUpperCase()}_FAILED`);
  return {
    raceMatch: null,
    raceIntelligence: null,
    raceEnrichment: { status: "unavailable", linked, retryable: true, stage },
  };
}

const savedRunColumns =
  "id,started_at,finished_at,duration_seconds,activity_kind,activity_environment,activity_source,distance_meters,average_heart_rate_bpm,perceived_effort,endurance_race_goal_id,endurance_plan_session_key,endurance_session_intent,endurance_match_source";

async function loadSavedRun(supabase: Client, userId: string, sessionId: string) {
  const { data, error } = await supabase
    .from("workout_sessions")
    .select(savedRunColumns)
    .eq("user_id", userId)
    .eq("id", sessionId)
    .eq("activity_kind", "run")
    .not("finished_at", "is", null)
    .maybeSingle();
  if (error || !data) throw new Error("Saved run is unavailable.");
  return data;
}

type SavedRun = Awaited<ReturnType<typeof loadSavedRun>>;
function hasCompleteLink(run: SavedRun): boolean {
  return (
    run.endurance_race_goal_id !== null &&
    run.endurance_plan_session_key !== null &&
    run.endurance_session_intent !== null &&
    (run.endurance_match_source === "system_confident" ||
      run.endurance_match_source === "user_confirmed")
  );
}

/**
 * Re-read owned, completed evidence on every attempt. A committed match is final
 * for this operation, including when its response or subsequent analysis failed.
 * No insertion and no mutation of the immutable workout snapshot occur here.
 */
export async function retryEnduranceRaceEnrichment(
  supabase: Client,
  userId: string,
  input: unknown,
): Promise<EnduranceRaceEnrichmentResult> {
  const { workoutSessionId } = RetryEnduranceRaceEnrichmentSchema.parse(input);
  // Missing/foreign/incomplete records fail before optional enrichment and before
  // acquiring the privileged writer. A retry cannot invent a saved workout.
  const saved = await loadSavedRun(supabase, userId, workoutSessionId);
  let linked = hasCompleteLink(saved);
  let linkedGoalId = saved.endurance_race_goal_id;
  let stage: EnduranceEnrichmentStage = "classify";
  const result: EnduranceRaceEnrichmentResult = {
    raceMatch: null,
    raceIntelligence: null,
    raceEnrichment: { status: "no_active_plan", linked: false, retryable: false },
  };
  try {
    if (
      !linked &&
      [
        saved.endurance_race_goal_id,
        saved.endurance_plan_session_key,
        saved.endurance_session_intent,
        saved.endurance_match_source,
      ].some((value) => value !== null)
    ) {
      // Do not overwrite an incomplete legacy link and call it a fresh match.
      throw new Error("Incomplete saved match.");
    }
    const activity = EnduranceActivitySchema.parse({
      kind: saved.activity_kind,
      environment: saved.activity_environment,
      source: saved.activity_source,
      startedAt: saved.started_at,
      durationSeconds: saved.duration_seconds,
      distanceMeters: saved.distance_meters,
      averageHeartRateBpm: saved.average_heart_rate_bpm,
      perceivedEffort: saved.perceived_effort,
    });
    const { loadPersistedProfileTimeZone } = await import("./user-context.server");
    const timeZone = await loadPersistedProfileTimeZone(supabase, userId);
    const day = dayInTimeZone(new Date(activity.startedAt), timeZone);
    const prep = await loadActiveRacePrep(supabase, userId, day, timeZone);

    if (linked) {
      result.raceEnrichment = { status: "matched", linked: true, retryable: false };
      if (prep.status === "active" && prep.goalId === saved.endurance_race_goal_id) {
        result.raceIntelligence = {
          goalId: prep.goalId,
          decision: prep.intelligence,
          readiness: prep.readiness,
        };
      }
      return result;
    }
    if (prep.status !== "active") return result;

    const completed = new Set(prep.completedSessionKeys);
    const remaining = prep.effectiveSessions.filter(
      (session) => session.sessionKey && !completed.has(session.sessionKey),
    );
    const match = matchCompletedRunToPlan(remaining, {
      distanceMeters: activity.distanceMeters,
      durationMinutes: activity.durationSeconds / 60,
      perceivedEffort: activity.perceivedEffort,
    });
    if (match.status === "no_match") {
      result.raceMatch = match;
      result.raceEnrichment = { status: "no_match", linked: false, retryable: false };
    } else {
      const planned = remaining[match.plannedIndex];
      if (!planned || planned.sessionKey !== match.plannedSessionKey) {
        throw new Error("Race match does not identify a planned session.");
      }
      result.raceMatch = { ...match, raceGoalId: prep.goalId, intent: planned.intent };
      if (match.status === "needs_confirmation") {
        result.raceEnrichment = { status: "needs_confirmation", linked: false, retryable: false };
      } else {
        stage = "link";
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("workout_sessions")
          .update({
            endurance_race_goal_id: prep.goalId,
            endurance_plan_session_key: planned.sessionKey,
            endurance_session_intent: planned.intent,
            endurance_match_source: "system_confident",
            endurance_match_score: match.score,
          })
          .eq("id", saved.id)
          .eq("user_id", userId)
          .eq("activity_kind", "run")
          .not("finished_at", "is", null)
          .is("endurance_match_source", null)
          .is("endurance_race_goal_id", null)
          .is("endurance_plan_session_key", null)
          .is("endurance_session_intent", null)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          // Another request may have committed first. Prove that fact with the
          // authenticated read instead of overwriting it or assuming success.
          const winner = await loadSavedRun(supabase, userId, saved.id);
          linked = hasCompleteLink(winner);
          linkedGoalId = winner.endurance_race_goal_id;
          if (!linked) throw new Error("No race match was committed.");
          result.raceMatch = null;
        } else {
          linked = true;
          linkedGoalId = prep.goalId;
          const { tryPersistCurrentEnduranceAdaptation } =
            await import("./endurance-adaptation-refresh.service");
          await tryPersistCurrentEnduranceAdaptation(supabase, userId, day, timeZone);
        }
        result.raceEnrichment = { status: "matched", linked: true, retryable: false };
      }
    }

    stage = "refresh";
    const refreshed = linked ? await loadActiveRacePrep(supabase, userId, day, timeZone) : prep;
    if (
      refreshed.status === "active" &&
      refreshed.goalId === (linked ? linkedGoalId : prep.goalId)
    ) {
      result.raceIntelligence = {
        goalId: refreshed.goalId,
        decision: refreshed.intelligence,
        readiness: refreshed.readiness,
      };
    }
    return result;
  } catch {
    return unavailableEnduranceEnrichment(stage, linked);
  }
}
