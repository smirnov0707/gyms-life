import { z } from "zod";
import { ForecastEvidenceStrengthSchema, ForecastTrendSchema } from "./forecast.schema";

export const CoachPerformanceSignalSchema = z
  .object({
    exerciseSlug: z.string().min(1).max(120),
    exerciseName: z.string().min(1).max(200),
    trend: ForecastTrendSchema,
    evidenceStrength: ForecastEvidenceStrengthSchema,
    evidence: z
      .object({
        sessionCount: z.number().int().positive(),
        weeksTracked: z.number().int().positive(),
        spanDays: z.number().int().nonnegative(),
        averageRpe: z.number().min(1).max(10).nullable(),
        observedWeeklyChangeKg: z.number().finite(),
      })
      .strict(),
  })
  .strict();

export const CoachContextSchema = z.object({
  schemaVersion: z.literal("1.1"),
  user: z.object({ id: z.string().uuid() }),
  generatedAt: z.string().datetime(),
  goal: z.string().nullable(),
  activePlan: z
    .object({
      id: z.string().uuid(),
      title: z.string(),
      dayIndex: z.number().int().positive().nullable(),
    })
    .nullable(),
  performance: z.object({
    workouts: z.number().int().nonnegative(),
    totalVolumeKg: z.number().nonnegative(),
    totalSets: z.number().int().nonnegative(),
    totalReps: z.number().int().nonnegative(),
    averageRpe: z.number().nullable(),
  }),
  // This is a fact-only subset of the canonical deterministic performance
  // forecast. A provider can interpret these observations but may not treat
  // them as a load prescription or fabricated probability.
  performanceSignals: z.array(CoachPerformanceSignalSchema).max(6),
  exercises: z.array(
    z.object({
      exerciseSlug: z.string(),
      exerciseName: z.string(),
      sessions: z.number().int().nonnegative(),
      totalSets: z.number().int().nonnegative(),
      totalReps: z.number().int().nonnegative(),
      totalVolumeKg: z.number().nonnegative(),
      bestWeightKg: z.number().nullable(),
      bestReps: z.number().nullable(),
      bestEstimated1RMKg: z.number().nullable(),
      averageRpe: z.number().nullable(),
      latest: z
        .object({
          date: z.string().datetime(),
          weightKg: z.number().nullable(),
          reps: z.number().nullable(),
          rpe: z.number().nullable(),
          estimated1RMKg: z.number().nullable(),
        })
        .nullable(),
    }),
  ),
});

export const CoachRecommendationSchema = z.object({
  schemaVersion: z.literal("1.0"),
  decision: z.enum(["NO_CHANGE", "ADJUST_NEXT_WORKOUT", "ADJUST_PROGRAM"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  summary: z.string().min(1).max(500),
  rationale: z.array(z.string().min(1)).max(8),
  actions: z
    .array(
      z.object({
        type: z.enum([
          "INCREASE_LOAD",
          "DECREASE_LOAD",
          "CHANGE_REPS",
          "CHANGE_SETS",
          "CHANGE_REST",
          "KEEP_PLAN",
          "RECOVER",
        ]),
        exerciseSlug: z.string().nullable(),
        value: z.number().nullable(),
        unit: z.enum(["kg", "reps", "sets", "seconds", "percent"]).nullable(),
        instruction: z.string().min(1).max(240),
      }),
    )
    .max(12),
  confidence: z.number().min(0).max(1),
  safety: z.object({ requiresUserConfirmation: z.boolean(), notes: z.array(z.string()).max(6) }),
});

export type CoachContext = z.infer<typeof CoachContextSchema>;
export type CoachRecommendation = z.infer<typeof CoachRecommendationSchema>;

export interface AICoachWorker {
  readonly name: string;
  readonly version: string;
  generateRecommendation(context: CoachContext): Promise<CoachRecommendation>;
}

export function createCoachContext(input: Omit<CoachContext, "schemaVersion">): CoachContext {
  return CoachContextSchema.parse({ schemaVersion: "1.1", ...input });
}

export function parseCoachRecommendation(value: unknown): CoachRecommendation {
  return CoachRecommendationSchema.parse(value);
}
