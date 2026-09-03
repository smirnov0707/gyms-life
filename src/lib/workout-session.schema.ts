import { z } from "zod";
import type { Tables } from "@/integrations/supabase/types";

export const WORKOUT_SESSION_SELECT =
  "id, plan_id, day_index, title, started_at, finished_at, duration_seconds, total_volume, adaptation_modifier";

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
});

export type WorkoutSession = z.infer<typeof WorkoutSessionSchema>;

export function parseWorkoutSession(row: WorkoutSessionRow): WorkoutSession {
  return WorkoutSessionSchema.parse({
    id: row.id,
    planId: row.plan_id,
    dayIndex: row.day_index,
    title: row.title,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationSeconds: row.duration_seconds,
    totalVolume: row.total_volume,
    adaptationModifier: row.adaptation_modifier,
  });
}
