import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getTodaysWorkoutData } from "./active-plan.service";
import { adaptTrainingPlanDay } from "./training-guidance.service";

const Input = z.object({
  sessionId: z.string().uuid(),
  exerciseSlug: z.string().min(1).max(120),
  exerciseName: z.string().min(1).max(200),
  setNumber: z.coerce.number().int().positive(),
  reps: z.coerce.number().finite().int().min(1).max(100).nullable().optional(),
  weightKg: z.coerce.number().finite().nonnegative().max(1_000).nullable().optional(),
  rpe: z.coerce.number().finite().min(1).max(10).nullable().optional(),
  done: z.boolean().default(true),
});

const setLogSelect =
  "id, session_id, exercise_slug, exercise_name, set_number, reps, weight_kg, rpe, done, created_at";

export const logWorkoutSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: session, error: sessionError } = await supabase
      .from("workout_sessions")
      .select("id, user_id, plan_id, day_index, finished_at, adaptation_modifier")
      .eq("id", data.sessionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (sessionError) {
      throw new Error("Session lookup failed: " + sessionError.message);
    }
    if (!session) {
      throw new Error("Workout session not found.");
    }
    if (session.finished_at) {
      throw new Error("Workout session is already finished.");
    }
    if (session.plan_id === null || session.day_index === null) {
      throw new Error("Workout session is missing active plan metadata.");
    }

    const workout = await getTodaysWorkoutData(supabase, userId, session.day_index + 1);
    if (workout.status !== "READY" || workout.plan.id !== session.plan_id) {
      throw new Error("Workout plan is no longer available for this session.");
    }

    const adjustedWorkout = adaptTrainingPlanDay(workout.workout, session.adaptation_modifier);
    const exercise = adjustedWorkout.exercises.find((item) => item.slug === data.exerciseSlug);
    if (!exercise) {
      throw new Error("Exercise does not belong to this workout.");
    }
    if (exercise.name !== data.exerciseName) {
      throw new Error("Exercise name does not match the workout plan.");
    }
    if (data.setNumber > exercise.sets) {
      throw new Error("Set number exceeds the planned " + exercise.sets + " sets.");
    }

    const { data: duplicate, error: duplicateError } = await supabase
      .from("set_logs")
      .select(setLogSelect)
      .eq("session_id", session.id)
      .eq("exercise_slug", data.exerciseSlug)
      .eq("set_number", data.setNumber)
      .maybeSingle();

    if (duplicateError) {
      throw new Error("Set lookup failed: " + duplicateError.message);
    }
    if (duplicate) {
      return { ok: true, setLog: duplicate, alreadyLogged: true };
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
      })
      .select(setLogSelect)
      .single();

    if (!error && setLog) {
      return { ok: true, setLog, alreadyLogged: false };
    }

    if (error?.code === "23505") {
      const { data: existing, error: existingError } = await supabase
        .from("set_logs")
        .select(setLogSelect)
        .eq("session_id", session.id)
        .eq("exercise_slug", data.exerciseSlug)
        .eq("set_number", data.setNumber)
        .maybeSingle();

      if (existingError) {
        throw new Error("Set retry lookup failed: " + existingError.message);
      }
      if (existing) {
        return { ok: true, setLog: existing, alreadyLogged: true };
      }
    }

    throw new Error("Could not save set: " + (error?.message ?? "unknown error"));
  });
