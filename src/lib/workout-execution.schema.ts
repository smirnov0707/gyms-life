import { z } from "zod";
import { TrainingPlanDaySchema } from "./training-plan.schema";

export const WorkoutAdaptationReasonSchema = z.enum([
  "readiness",
  "high_stress",
  "time_limit",
  "travel",
  "equipment_limit",
  "facility_closed",
]);

export type WorkoutAdaptationReason = z.infer<typeof WorkoutAdaptationReasonSchema>;

export const WorkoutExerciseSubstitutionSchema = z
  .object({
    fromSlug: z.string().trim().min(1).max(120),
    toSlug: z.string().trim().min(1).max(120),
  })
  .strict();

export const WorkoutExecutionAdaptationSchema = z
  .object({
    version: z.literal("1.0"),
    readinessModifier: z.number().finite().min(0.5).max(1.1),
    reasons: z.array(WorkoutAdaptationReasonSchema).max(5),
    sourceContextIds: z.array(z.string().uuid()).max(12),
    timeBudgetMinutes: z.number().int().min(10).max(180).nullable(),
    substitutions: z.array(WorkoutExerciseSubstitutionSchema).max(20),
    omittedExerciseSlugs: z.array(z.string().trim().min(1).max(120)).max(20),
  })
  .strict();

export type WorkoutExecutionAdaptation = z.infer<typeof WorkoutExecutionAdaptationSchema>;

/**
 * An immutable, validated execution contract. A session always logs and
 * completes against this exact plan, never against a later-changing context.
 */
export const WorkoutExecutionSnapshotSchema = z
  .object({
    version: z.literal("1.0"),
    workout: TrainingPlanDaySchema,
    adaptation: WorkoutExecutionAdaptationSchema,
  })
  .strict();

export type WorkoutExecutionSnapshot = z.infer<typeof WorkoutExecutionSnapshotSchema>;

export function parseWorkoutExecutionSnapshot(value: unknown): WorkoutExecutionSnapshot | null {
  const parsed = WorkoutExecutionSnapshotSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
