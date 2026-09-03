import { z } from "zod";
import type { Tables } from "@/integrations/supabase/types";
import { WorkoutExecutionSnapshotSchema } from "./workout-execution.schema";

export const WORKOUT_SESSION_SELECT =
  "id, plan_id, day_index, title, started_at, finished_at, duration_seconds, total_volume, adaptation_modifier, workout_snapshot";

export type WorkoutSessionRow = Pick<
  Tables<"workout_sessions">,
  | "id"
  | "plan_id"
  | "day_index"
  | "title"
  | "started_at"
  | "finished_at"
  | "duration_seconds"
  | "total_volume"
  | "adaptation_modifier"
  | "workout_snapshot"
>;

export const WorkoutSessionSchema = z.object({
  id: z.string().uuid(),
  planId: z.string().uuid().nullable(),
  dayIndex: z.number().int().nonnegative().nullable(),
  title: z.string().nullable(),
  startedAt: z.string().datetime({ offset: true }),
  finishedAt: z.string().datetime({ offset: true }).nullable(),
  durationSeconds: z.number().int().nonnegative().nullable(),
  totalVolume: z.number().finite().nonnegative(),
  adaptationModifier: z.number().finite().min(0.5).max(1.1),
  workoutSnapshot: WorkoutExecutionSnapshotSchema.nullable(),
});

export type WorkoutSession = z.infer<typeof WorkoutSessionSchema>;

export const CompletedWorkoutSessionSchema = WorkoutSessionSchema.extend({
  finishedAt: z.string().datetime({ offset: true }),
});

export type CompletedWorkoutSession = z.infer<typeof CompletedWorkoutSessionSchema>;

function normalizeWorkoutSessionRow(row: WorkoutSessionRow) {
  return {
    id: row.id,
    planId: row.plan_id,
    dayIndex: row.day_index,
    title: row.title,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationSeconds: row.duration_seconds,
    totalVolume: row.total_volume,
    adaptationModifier: row.adaptation_modifier,
    workoutSnapshot:
      row.workout_snapshot === null
        ? null
        : WorkoutExecutionSnapshotSchema.parse(row.workout_snapshot),
  };
}

export function parseWorkoutSession(row: WorkoutSessionRow): WorkoutSession {
  return WorkoutSessionSchema.parse(normalizeWorkoutSessionRow(row));
}

export function parseCompletedWorkoutSession(row: WorkoutSessionRow): CompletedWorkoutSession {
  return CompletedWorkoutSessionSchema.parse(normalizeWorkoutSessionRow(row));
}

/** Invalid historical rows are excluded before they can reach performance logic. */
export function parseCompletedWorkoutSessions(
  rows: WorkoutSessionRow[],
): CompletedWorkoutSession[] {
  return rows.flatMap((row) => {
    const parsed = CompletedWorkoutSessionSchema.safeParse(normalizeWorkoutSessionRow(row));
    return parsed.success ? [parsed.data] : [];
  });
}
