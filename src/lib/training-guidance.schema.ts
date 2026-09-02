import { z } from "zod";

export const WorkoutGuidanceHistorySetSchema = z.object({
  sessionId: z.string().uuid(),
  finishedAt: z.string().datetime(),
  setNumber: z.number().int().positive().max(30),
  reps: z.number().int().positive().max(100).nullable(),
  weightKg: z.number().finite().positive().max(1_000).nullable(),
  rpe: z.number().finite().min(1).max(10).nullable(),
});

export type WorkoutGuidanceHistorySet = z.infer<typeof WorkoutGuidanceHistorySetSchema>;

/** Invalid historical rows are skipped so one old bad record cannot block a workout. */
export function parseWorkoutGuidanceHistory(value: unknown): WorkoutGuidanceHistorySet[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    const parsed = WorkoutGuidanceHistorySetSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}
