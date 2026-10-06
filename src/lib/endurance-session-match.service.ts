import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

export const ConfirmRaceSessionMatchSchema = z
  .object({
    workoutSessionId: z.string().uuid(),
    raceGoalId: z.string().uuid(),
    planSessionKey: z.string().regex(/^w\d+-s\d+$/),
  })
  .strict();

export async function confirmRaceSessionMatch(
  supabase: SupabaseClient<Database>,
  userId: string,
  value: unknown,
) {
  const input = ConfirmRaceSessionMatchSchema.parse(value);

  const { data: workout, error: workoutError } = await supabase
    .from("workout_sessions")
    .select("id,started_at,distance_meters,duration_seconds,perceived_effort")
    .eq("id", input.workoutSessionId)
    .eq("user_id", userId)
    .eq("activity_kind", "run")
    .maybeSingle();
  if (workoutError || !workout) throw new Error("Run could not be loaded.");

  const { loadPersistedProfileTimeZone } = await import("./user-context.server");
  const { dayInTimeZone } = await import("./local-day");
  const { loadActiveRacePrep } = await import("./endurance-race-prep.service");
  const { matchCompletedRunToPlan } = await import("./endurance-session-matching.engine");

  const timeZone = await loadPersistedProfileTimeZone(supabase, userId);
  const today = dayInTimeZone(new Date(workout.started_at), timeZone);
  const prep = await loadActiveRacePrep(supabase, userId, today, timeZone);

  if (prep.status !== "active" || prep.goalId !== input.raceGoalId) {
    throw new Error("Race preparation is no longer active.");
  }

  const completedKeys = new Set(prep.completedSessionKeys);
  const remaining = prep.effectiveSessions.filter(
    (session) => !completedKeys.has(session.sessionKey),
  );
  const match = matchCompletedRunToPlan(remaining, {
    distanceMeters: workout.distance_meters === null ? null : Number(workout.distance_meters),
    durationMinutes: Number(workout.duration_seconds ?? 0) / 60,
    perceivedEffort: workout.perceived_effort,
  });

  if (match.status === "no_match" || match.plannedSessionKey !== input.planSessionKey) {
    throw new Error("Race session candidate is no longer supported by current evidence.");
  }

  const plannedSession = remaining[match.plannedIndex];
  if (!plannedSession || plannedSession.sessionKey !== match.plannedSessionKey) {
    throw new Error("Planned race session could not be verified.");
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows, error } = await supabaseAdmin.rpc("confirm_endurance_race_session_match", {
    p_user_id: userId,
    p_workout_session_id: input.workoutSessionId,
    p_race_goal_id: prep.goalId,
    p_plan_session_key: plannedSession.sessionKey,
    p_intent: plannedSession.intent,
    p_match_score: match.score,
  });
  if (error) throw error;

  const data = rows?.[0] ?? null;
  if (!data) throw new Error("Race session could not be confirmed.");

  const { tryPersistCurrentEnduranceAdaptation } =
    await import("./endurance-adaptation-refresh.service");
  await tryPersistCurrentEnduranceAdaptation(supabase, userId, today, timeZone);
  return data;
}
