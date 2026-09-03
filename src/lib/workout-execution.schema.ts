import { z } from "zod";
import { TrainingPlanDaySchema } from "./training-plan.schema";

export const WorkoutAdaptationReasonSchema = z.enum([
  "readiness",
  "training_response",
  "high_stress",
  "time_limit",
  "travel",
  "equipment_limit",
  "facility_closed",
]);

export type WorkoutAdaptationReason = z.infer<typeof WorkoutAdaptationReasonSchema>;

export const WorkoutVolumeModifierSchema = z.number().finite().min(0.5).max(1.1);

export const WorkoutExerciseSubstitutionSchema = z
  .object({
    fromSlug: z.string().trim().min(1).max(120),
    toSlug: z.string().trim().min(1).max(120),
  })
  .strict();

const WorkoutExecutionAdaptationBaseSchema = z
  .object({
    reasons: z.array(WorkoutAdaptationReasonSchema).max(6),
    sourceContextIds: z.array(z.string().uuid()).max(12),
    timeBudgetMinutes: z.number().int().min(10).max(180).nullable(),
    substitutions: z.array(WorkoutExerciseSubstitutionSchema).max(20),
    omittedExerciseSlugs: z.array(z.string().trim().min(1).max(120)).max(20),
  })
  .strict();

/** Maintains existing completed-session snapshots without reinterpretation. */
export const LegacyWorkoutExecutionAdaptationSchema = WorkoutExecutionAdaptationBaseSchema.extend({
  version: z.literal("1.0"),
  readinessModifier: WorkoutVolumeModifierSchema,
}).strict();

/**
 * Separates the raw readiness modifier from a response-derived guard and the
 * effective volume modifier. The snapshot is the durable provenance record
 * for the exact session the athlete executed.
 */
export const CurrentWorkoutExecutionAdaptationSchema = WorkoutExecutionAdaptationBaseSchema.extend({
  version: z.literal("1.1"),
  readinessModifier: WorkoutVolumeModifierSchema,
  trainingResponseModifier: WorkoutVolumeModifierSchema,
  volumeModifier: WorkoutVolumeModifierSchema,
}).strict();

export const WorkoutExecutionAdaptationSchema = z.discriminatedUnion("version", [
  LegacyWorkoutExecutionAdaptationSchema,
  CurrentWorkoutExecutionAdaptationSchema,
]);

export type WorkoutExecutionAdaptation = z.infer<typeof WorkoutExecutionAdaptationSchema>;

/**
 * An immutable, validated execution contract. A session always logs and
 * completes against this exact plan, never against a later-changing context.
 */
const LegacyWorkoutExecutionSnapshotSchema = z
  .object({
    version: z.literal("1.0"),
    workout: TrainingPlanDaySchema,
    adaptation: LegacyWorkoutExecutionAdaptationSchema,
  })
  .strict();

const CurrentWorkoutExecutionSnapshotSchema = z
  .object({
    version: z.literal("1.1"),
    workout: TrainingPlanDaySchema,
    adaptation: CurrentWorkoutExecutionAdaptationSchema,
  })
  .strict();

export const WorkoutExecutionSnapshotSchema = z.discriminatedUnion("version", [
  LegacyWorkoutExecutionSnapshotSchema,
  CurrentWorkoutExecutionSnapshotSchema,
]);

export type WorkoutExecutionSnapshot = z.infer<typeof WorkoutExecutionSnapshotSchema>;

/** Returns the volume modifier actually applied to a durable session snapshot. */
export function volumeModifierForWorkoutAdaptation(adaptation: WorkoutExecutionAdaptation): number {
  return adaptation.version === "1.1" ? adaptation.volumeModifier : adaptation.readinessModifier;
}

/**
 * Response feedback can reduce working-set volume without pretending that the
 * athlete's working weight should also be reduced. Readiness and high stress
 * retain their established load-guidance behavior.
 */
export function loadModifierForWorkoutAdaptation(adaptation: WorkoutExecutionAdaptation): number {
  if (adaptation.version === "1.0") return adaptation.readinessModifier;
  return adaptation.reasons.includes("high_stress")
    ? Math.min(adaptation.readinessModifier, 0.8)
    : adaptation.readinessModifier;
}

export function parseWorkoutExecutionSnapshot(value: unknown): WorkoutExecutionSnapshot | null {
  const parsed = WorkoutExecutionSnapshotSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
