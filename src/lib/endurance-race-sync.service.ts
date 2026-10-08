import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { EnduranceSessionIntentSchema } from "./endurance-race-goal.schema";
import { matchCompletedRunToPlan } from "./endurance-session-matching.engine";
import { loadActiveRacePrep } from "./endurance-race-prep.service";
import { dayInTimeZone } from "./local-day";
import {
  RetryEnduranceRaceSyncSchema,
  type EnduranceRaceMatch,
  type EnduranceRaceSyncResult,
} from "./endurance-race-sync.schema";

type Client = SupabaseClient<Database>;
const RUN_COLUMNS =
  "id,started_at,finished_at,distance_meters,duration_seconds,perceived_effort,endurance_race_goal_id,endurance_plan_session_key,endurance_session_intent,endurance_match_source";
const SavedRunSchema = z.object({
  id: z.string().uuid(),
  started_at: z.string().datetime({ offset: true }),
  finished_at: z.string().datetime({ offset: true }),
  distance_meters: z.number().finite().positive().nullable(),
  duration_seconds: z.number().finite().positive(),
  perceived_effort: z.number().int().min(1).max(10).nullable(),
  endurance_race_goal_id: z.string().uuid().nullable(),
  endurance_plan_session_key: z
    .string()
    .regex(/^w\d+-s\d+$/)
    .nullable(),
  endurance_session_intent: EnduranceSessionIntentSchema.nullable(),
  endurance_match_source: z.enum(["system_confident", "user_confirmed"]).nullable(),
});
type SavedRun = z.infer<typeof SavedRunSchema>;

async function loadOwnedRun(supabase: Client, userId: string, id: string): Promise<SavedRun> {
  const { data, error } = await supabase
    .from("workout_sessions")
    .select(RUN_COLUMNS)
    .eq("id", id)
    .eq("user_id", userId)
    .eq("activity_kind", "run")
    .not("finished_at", "is", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("completed_run_unavailable");
  return SavedRunSchema.parse(data);
}

function existingMatch(run: SavedRun): EnduranceRaceMatch | null {
  if (
    run.endurance_race_goal_id &&
    run.endurance_plan_session_key &&
    run.endurance_session_intent &&
    run.endurance_match_source
  ) {
    return {
      status: "already_linked",
      raceGoalId: run.endurance_race_goal_id,
      plannedSessionKey: run.endurance_plan_session_key,
      intent: run.endurance_session_intent,
    };
  }
  // Never repair a partial association by silently assigning a different plan.
  if (run.endurance_race_goal_id || run.endurance_plan_session_key || run.endurance_match_source)
    throw new Error("incomplete_race_link");
  return null;
}

/** Safe to repeat for a saved run. Never inserts a session or changes its workload. */
export async function synchronizeEnduranceRace(
  supabase: Client,
  userId: string,
  value: unknown,
): Promise<EnduranceRaceSyncResult> {
  const { workoutSessionId } = RetryEnduranceRaceSyncSchema.parse(value);
  let raceMatch: EnduranceRaceMatch | null = null;
  let phase: "matching" | "insights" = "matching";
  try {
    const run = await loadOwnedRun(supabase, userId, workoutSessionId);
    raceMatch = existingMatch(run);
    if (raceMatch) phase = "insights";
    const { loadPersistedProfileTimeZone } = await import("./user-context.server");
    const timeZone = await loadPersistedProfileTimeZone(supabase, userId);
    const today = dayInTimeZone(new Date(run.started_at), timeZone);
    const prep = await loadActiveRacePrep(supabase, userId, today, timeZone);
    if (prep.status !== "active") {
      return {
        raceMatch,
        raceIntelligence: null,
        raceSync: { status: raceMatch ? "matched" : "no_active_plan" },
      };
    }
    if (!raceMatch) {
      const completed = new Set(prep.completedSessionKeys);
      const remaining = prep.effectiveSessions.filter((s) => !completed.has(s.sessionKey));
      const candidate = matchCompletedRunToPlan(remaining, {
        distanceMeters: run.distance_meters,
        durationMinutes: run.duration_seconds / 60,
        perceivedEffort: run.perceived_effort,
      });
      if (candidate.status === "no_match") {
        raceMatch = candidate;
      } else {
        const session = remaining[candidate.plannedIndex];
        if (!session || session.sessionKey !== candidate.plannedSessionKey) {
          throw new Error("race_candidate_unavailable");
        }
        const proposed = { ...candidate, raceGoalId: prep.goalId, intent: session.intent };
        if (candidate.status === "needs_confirmation") {
          raceMatch = proposed;
        } else {
          // Only the authenticated, completed row loaded above may be enriched.
          // Compare-and-set prevents retries overwriting a simultaneous user confirmation.
          // The existing unique plan-match index arbitrates competing runs.
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          let write = supabaseAdmin
            .from("workout_sessions")
            .update({
              endurance_race_goal_id: prep.goalId,
              endurance_plan_session_key: session.sessionKey,
              endurance_session_intent: session.intent,
              endurance_match_source: "system_confident",
              endurance_match_score: candidate.score,
            })
            .eq("id", workoutSessionId)
            .eq("user_id", userId)
            .eq("activity_kind", "run")
            .eq("started_at", run.started_at)
            .eq("finished_at", run.finished_at)
            .eq("duration_seconds", run.duration_seconds)
            .is("endurance_race_goal_id", null)
            .is("endurance_plan_session_key", null)
            .is("endurance_match_source", null);
          write =
            run.distance_meters === null
              ? write.is("distance_meters", null)
              : write.eq("distance_meters", run.distance_meters);
          write =
            run.perceived_effort === null
              ? write.is("perceived_effort", null)
              : write.eq("perceived_effort", run.perceived_effort);
          const { data: saved, error } = await write.select("id").maybeSingle();
          if (error && error.code !== "23505") throw error;
          if (error || !saved) {
            // One read only: accept an already committed winner, never guess a
            // second target or report an UPDATE of zero rows as success.
            raceMatch = existingMatch(await loadOwnedRun(supabase, userId, workoutSessionId));
            if (!raceMatch) throw new Error("race_match_conflict");
          } else {
            if (saved.id !== workoutSessionId) throw new Error("race_match_identity_mismatch");
            raceMatch = proposed;
          }
        }
      }
    }

    phase = "insights";
    const matched = raceMatch.status === "confident" || raceMatch.status === "already_linked";
    // A historical confirmed association stays attached to its original goal.
    if (
      (raceMatch.status === "confident" || raceMatch.status === "already_linked") &&
      raceMatch.raceGoalId !== prep.goalId
    ) {
      return { raceMatch, raceIntelligence: null, raceSync: { status: "matched" } };
    }
    if (matched) {
      const { tryPersistCurrentEnduranceAdaptation } =
        await import("./endurance-adaptation-refresh.service");
      await tryPersistCurrentEnduranceAdaptation(supabase, userId, today, timeZone);
    }
    const refreshed = matched ? await loadActiveRacePrep(supabase, userId, today, timeZone) : prep;
    return {
      raceMatch,
      raceIntelligence:
        refreshed.status === "active" && refreshed.goalId === prep.goalId
          ? {
              goalId: refreshed.goalId,
              decision: refreshed.intelligence,
              readiness: refreshed.readiness,
            }
          : null,
      raceSync: {
        status: matched
          ? "matched"
          : raceMatch.status === "needs_confirmation"
            ? "needs_confirmation"
            : "no_match",
      },
    };
  } catch (error) {
    // The activity is already saved. A failed enrichment must be visible and
    // retryable, but must never invite the athlete to save the run twice.
    // Bound the diagnostics: database messages may include private row values.
    const code = z.object({ code: z.string().regex(/^[A-Z0-9_]{2,32}$/) }).safeParse(error);
    console.error("[Endurance] Race synchronization deferred.", {
      workoutSessionId,
      phase,
      code: code.success ? code.data.code : "race_sync_unavailable",
    });
    return { raceMatch, raceIntelligence: null, raceSync: { status: "deferred", phase } };
  }
}
