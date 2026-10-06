import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

export const ConfirmRaceSessionMatchSchema = z
  .object({
    workoutSessionId: z.string().uuid(),
    raceGoalId: z.string().uuid(),
    planSessionKey: z.string().regex(/^w\d+-s\d+$/),
    matchScore: z.number().min(0).max(1).nullable(),
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
    .select("id,started_at")
    .eq("id", input.workoutSessionId)
    .eq("user_id", userId)
    .eq("activity_kind", "run")
    .maybeSingle();
  if (workoutError || !workout) throw new Error("Run could not be loaded.");

  const { loadPersistedProfileTimeZone } = await import("./user-context.server");
  const { dayInTimeZone } = await import("./local-day");
  const { loadActiveRacePrep } = await import("./endurance-race-prep.service");
  const timeZone = await loadPersistedProfileTimeZone(supabase, userId);
  const today = dayInTimeZone(new Date(workout.started_at), timeZone);
  const prep = await loadActiveRacePrep(supabase, userId, today, timeZone);

  if (prep.status !== "active" || prep.goalId !== input.raceGoalId) {
    throw new Error("Race preparation is no longer active.");
  }

  const plannedSession = prep.currentWeek.sessions.find(
    (session) => session.sessionKey === input.planSessionKey,
  );
  if (!plannedSession) throw new Error("Planned race session could not be verified.");

  const { data, error } = await supabase
    .from("workout_sessions")
    .update({
      endurance_race_goal_id: prep.goalId,
      endurance_plan_session_key: plannedSession.sessionKey,
      endurance_session_intent: plannedSession.intent,
      endurance_match_source: "user_confirmed",
      endurance_match_score: input.matchScore,
    })
    .eq("id", input.workoutSessionId)
    .eq("user_id", userId)
    .eq("activity_kind", "run")
    .select(
      "id,started_at,endurance_race_goal_id,endurance_plan_session_key,endurance_session_intent,endurance_match_source",
    )
    .single();
  if (error) throw error;

  const { tryPersistCurrentEnduranceAdaptation } = await import(
    "./endurance-adaptation-refresh.service"
  );
  await tryPersistCurrentEnduranceAdaptation(supabase, userId, today, timeZone);
  return data;
}
