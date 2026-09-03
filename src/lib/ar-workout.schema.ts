import { z } from "zod";

const ExerciseSlugSchema = z.string().regex(/^[a-z][a-z0-9-]{0,119}$/);

export const ArWorkoutInputSchema = z
  .object({
    sessionId: z.string().uuid(),
    exerciseSlug: ExerciseSlugSchema,
    exerciseName: z.string().trim().min(1).max(200),
    reps: z.coerce.number().int().min(1).max(100),
    weightKg: z.coerce.number().finite().nonnegative().max(1_000),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

export type ArWorkoutInput = z.infer<typeof ArWorkoutInputSchema>;
