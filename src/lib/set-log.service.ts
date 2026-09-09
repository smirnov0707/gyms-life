import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { WorkoutSetSync } from "./offline-contract";
import { loadSessionPlannedDay } from "./session-plan.server";
import { validateWorkoutSetAgainstPlan } from "./workout-set.engine";
import { resolvePerformedAt } from "./performed-at.engine";
import { parseWorkoutSession, WORKOUT_SESSION_SELECT } from "./workout-session.schema";

const setLogSelect =
  "id, session_id, exercise_slug, exercise_name, set_number, reps, weight_kg, rpe, done, created_at, performed_at";

export async function recordOwnedWorkoutSet(
  supabase: SupabaseClient<Database>,
  userId: string,
  data: WorkoutSetSync,
) {
  const { data: rawSession, error: sessionError } = await supabase
    .from("workout_sessions")
    .select(WORKOUT_SESSION_SELECT)
    .eq("id", data.sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (sessionError) {
    throw new Error("Session lookup failed: " + sessionError.message);
  }
  if (!rawSession) {
    throw new Error("Workout session not found.");
  }
  const session = parseWorkoutSession(rawSession);
  if (session.finishedAt) {
    throw new Error("Workout session is already finished.");
  }
  const sessionDayIndex = session.dayIndex;
  if (sessionDayIndex === null) {
    throw new Error("Workout session is missing active plan metadata.");
  }

  const plannedDay = await loadSessionPlannedDay(supabase, userId, session);
  if (!plannedDay) {
    throw new Error("The planned workout day could not be found for this session.");
  }
  const { beyondPlan } = validateWorkoutSetAgainstPlan(plannedDay, data);

  const { data: duplicate, error: duplicateError } = await supabase
    .from("set_logs")
    .select(setLogSelect)
    .eq("session_id", session.id)
    .eq("user_id", userId)
    .eq("exercise_slug", data.exerciseSlug)
    .eq("set_number", data.setNumber)
    .maybeSingle();

  if (duplicateError) {
    throw new Error("Set lookup failed: " + duplicateError.message);
  }
  if (duplicate) {
    return { ok: true, setLog: duplicate, alreadyLogged: true, beyondPlan };
  }

  const { data: setLog, error } = await supabase
    .from("set_logs")
    .insert({
      user_id: userId,
      session_id: session.id,
      exercise_slug: data.exerciseSlug,
      exercise_name: data.exerciseName,
      set_number: data.setNumber,
      reps: data.reps ?? null,
      weight_kg: data.weightKg ?? null,
      rpe: data.rpe ?? null,
      done: data.done,
      // The client is the only party that knows when the set actually
      // happened; the engine bounds what it is allowed to claim.
      performed_at: resolvePerformedAt(data.performedAt, new Date()).toISOString(),
    })
    .select(setLogSelect)
    .single();

  if (!error && setLog) {
    return { ok: true, setLog, alreadyLogged: false, beyondPlan };
  }

  if (error?.code === "23505") {
    const { data: existing, error: existingError } = await supabase
      .from("set_logs")
      .select(setLogSelect)
      .eq("session_id", session.id)
      .eq("user_id", userId)
      .eq("exercise_slug", data.exerciseSlug)
      .eq("set_number", data.setNumber)
      .maybeSingle();

    if (existingError) {
      throw new Error("Set retry lookup failed: " + existingError.message);
    }
    if (existing) {
      return { ok: true, setLog: existing, alreadyLogged: true, beyondPlan };
    }
  }

  throw new Error("Could not save set: " + (error?.message ?? "unknown error"));
}
