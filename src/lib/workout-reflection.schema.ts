import { z } from "zod";

/**
 * A deliberately small, user-reported signal about a completed session.
 * It is not a readiness score, diagnosis, or inferred recovery metric.
 */
export const WorkoutFeelingSchema = z.number().int().min(1).max(5);

export const WorkoutReflectionInputSchema = z
  .object({
    sessionId: z.string().uuid(),
    feeling: WorkoutFeelingSchema,
  })
  .strict();

export const WorkoutReflectionRowSchema = z
  .object({
    id: z.string().uuid(),
    feeling: WorkoutFeelingSchema,
    finished_at: z.string().datetime({ offset: true }),
  })
  .strict();

export const WorkoutReflectionSchema = z
  .object({
    sessionId: z.string().uuid(),
    feeling: WorkoutFeelingSchema,
    finishedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type WorkoutReflectionInput = z.infer<typeof WorkoutReflectionInputSchema>;
export type WorkoutReflection = z.infer<typeof WorkoutReflectionSchema>;

/** Maps a validated, narrow DB row into the app-owned reflection contract. */
export function parseWorkoutReflection(value: unknown): WorkoutReflection {
  const row = WorkoutReflectionRowSchema.parse(value);
  return WorkoutReflectionSchema.parse({
    sessionId: row.id,
    feeling: row.feeling,
    finishedAt: row.finished_at,
  });
}
