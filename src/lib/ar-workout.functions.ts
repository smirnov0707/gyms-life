import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CompletedWorkoutSessionSchema } from "./workout-session.schema";
import { WorkoutSetLogSchema } from "./workout-set-log.schema";
import { ArWorkoutInputSchema } from "./ar-workout.schema";

export const recordArWorkout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => ArWorkoutInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: records, error } = await context.supabase.rpc("record_ar_workout", {
      p_session_id: data.sessionId,
      p_exercise_slug: data.exerciseSlug,
      p_exercise_name: data.exerciseName,
      p_reps: data.reps,
      p_weight_kg: data.weightKg,
      ...(data.notes ? { p_notes: data.notes } : {}),
    });

    if (error) {
      throw new Error(`Could not record AR workout: ${error.message}`);
    }

    const record = records?.[0];
    if (!record) {
      throw new Error("Could not record AR workout: database returned no result.");
    }

    const session = CompletedWorkoutSessionSchema.parse({
      id: record.session_id,
      planId: record.session_plan_id,
      dayIndex: record.session_day_index,
      title: record.session_title,
      startedAt: record.session_started_at,
      finishedAt: record.session_finished_at,
      durationSeconds: record.session_duration_seconds,
      totalVolume: record.session_total_volume,
      adaptationModifier: record.session_adaptation_modifier,
    });
    const setLog = WorkoutSetLogSchema.parse({
      id: record.set_log_id,
      sessionId: record.session_id,
      exerciseSlug: record.set_log_exercise_slug,
      exerciseName: record.set_log_exercise_name,
      setNumber: record.set_log_set_number,
      reps: record.set_log_reps,
      weightKg: record.set_log_weight_kg,
      rpe: record.set_log_rpe,
      done: record.set_log_done,
      createdAt: record.set_log_created_at,
    });

    return { session, setLog };
  });
