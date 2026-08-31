import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getTodaysWorkout } from "./todays-workout.functions";

const Input = z.object({
  sessionId: z.string().uuid(),
  exerciseSlug: z.string().min(1).max(120),
  exerciseName: z.string().min(1).max(200),
  setNumber: z.coerce.number().int().positive(),
  reps: z.coerce.number().int().positive().nullable().optional(),
  weightKg: z.coerce.number().nonnegative().nullable().optional(),
  rpe: z.coerce.number().min(0).max(10).nullable().optional(),
  done: z.boolean().default(true),
});

export const logWorkoutSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: session, error: sessionError } = await supabase
      .from("workout_sessions")
      .select("id, user_id, plan_id, day_index, finished_at")
      .eq("id", data.sessionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (sessionError) throw new Error(`Session lookup failed: ${sessionError.message}`);
    if (!session) throw new Error("Workout session not found.");
    if (session.finished_at) throw new Error("Workout session is already finished.");

    const workout = await getTodaysWorkout({ data: { day: session.day_index + 1 } });
    if (workout.status !== "READY" || workout.plan.id !== session.plan_id) {
      throw new Error("Workout plan is no longer available for this session.");
    }

    const exercise = workout.workout.exercises.find((item) => item.slug === data.exerciseSlug);
    if (!exercise) throw new Error("Exercise does not belong to this workout.");
    if (exercise.name !== data.exerciseName) throw new Error("Exercise name does not match the workout plan.");
    if (data.setNumber > exercise.sets) throw new Error(`Set number exceeds the planned ${exercise.sets} sets.`);

    const { data: duplicate, error: duplicateError } = await supabase
      .from("set_logs")
      .select("id")
      .eq("session_id", session.id)
      .eq("exercise_slug", data.exerciseSlug)
      .eq("set_number", data.setNumber)
      .maybeSingle();

    if (duplicateError) throw new Error(`Set lookup failed: ${duplicateError.message}`);
    if (duplicate) throw new Error("This set has already been logged.");

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
      .select("id, session_id, exercise_slug, exercise_name, set_number, reps, weight_kg, rpe, done, created_at")
      .single();

    if (error || !setLog) throw new Error(`Could not save set: ${error?.message ?? "unknown error"}`);

    return { ok: true as const, setLog };
  });