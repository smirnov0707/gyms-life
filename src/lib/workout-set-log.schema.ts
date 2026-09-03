import { z } from "zod";
import type { Tables } from "@/integrations/supabase/types";

export const WORKOUT_SET_LOG_SELECT =
  "id, session_id, exercise_slug, exercise_name, set_number, reps, weight_kg, rpe, done, created_at";

export type WorkoutSetLogRow = Pick<
  Tables<"set_logs">,
  | "id"
  | "session_id"
  | "exercise_slug"
  | "exercise_name"
  | "set_number"
  | "reps"
  | "weight_kg"
  | "rpe"
  | "done"
  | "created_at"
>;

export const WorkoutSetLogSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  exerciseSlug: z.string().min(1).max(120),
  exerciseName: z.string().min(1).max(200),
  setNumber: z.number().int().positive().max(30),
  reps: z.number().int().positive().max(100).nullable(),
  weightKg: z.number().finite().nonnegative().max(1_000).nullable(),
  rpe: z.number().finite().min(1).max(10).nullable(),
  done: z.boolean(),
  createdAt: z.string().datetime({ offset: true }),
});

export type WorkoutSetLog = z.infer<typeof WorkoutSetLogSchema>;

export function parseWorkoutSetLog(row: WorkoutSetLogRow): WorkoutSetLog {
  return WorkoutSetLogSchema.parse({
    id: row.id,
    sessionId: row.session_id,
    exerciseSlug: row.exercise_slug,
    exerciseName: row.exercise_name,
    setNumber: row.set_number,
    reps: row.reps,
    weightKg: row.weight_kg,
    rpe: row.rpe,
    done: row.done,
    createdAt: row.created_at,
  });
}

/** Invalid historical rows are excluded before they can reach progress or AI logic. */
export function parseWorkoutSetLogs(rows: WorkoutSetLogRow[]): WorkoutSetLog[] {
  return rows.flatMap((row) => {
    const parsed = WorkoutSetLogSchema.safeParse({
      id: row.id,
      sessionId: row.session_id,
      exerciseSlug: row.exercise_slug,
      exerciseName: row.exercise_name,
      setNumber: row.set_number,
      reps: row.reps,
      weightKg: row.weight_kg,
      rpe: row.rpe,
      done: row.done,
      createdAt: row.created_at,
    });
    return parsed.success ? [parsed.data] : [];
  });
}
