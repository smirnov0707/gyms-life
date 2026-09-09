import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { recordOwnedWorkoutSet } from "./set-log.service";
const Input = z.object({
  ownerId: z.string().uuid().optional(),
  sessionId: z.string().uuid(),
  exerciseSlug: z.string().min(1).max(120),
  exerciseName: z.string().min(1).max(200),
  setNumber: z.coerce.number().int().positive(),
  reps: z.coerce.number().finite().int().min(1).max(100).nullable().optional(),
  weightKg: z.coerce.number().finite().nonnegative().max(1_000).nullable().optional(),
  rpe: z.coerce.number().finite().min(1).max(10).nullable().optional(),
  done: z.boolean().default(true),
  performedAt: z.string().datetime().optional(),
});

export const logWorkoutSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    if (data.ownerId !== undefined && data.ownerId !== context.userId)
      throw new Error("OFFLINE_IDENTITY_CHANGED");
    return recordOwnedWorkoutSet(context.supabase, context.userId, {
      ...data,
      reps: data.reps ?? null,
      weightKg: data.weightKg ?? null,
      rpe: data.rpe ?? null,
    });
  });
