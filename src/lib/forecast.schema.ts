import { z } from "zod";

export const ForecastTrendSchema = z.enum(["rising", "flat", "falling"]);
export const ForecastEvidenceStrengthSchema = z.enum(["low", "moderate", "high"]);

export const DeterministicLiftForecastSchema = z
  .object({
    exerciseSlug: z.string().trim().min(1).max(120),
    exerciseName: z.string().trim().min(1).max(200),
    currentEstimated1RMKg: z.number().finite().positive().max(2_000),
    projected4WeeksEstimated1RMKg: z.number().finite().positive().max(2_000),
    projected12WeeksEstimated1RMKg: z.number().finite().positive().max(2_000),
    trend: ForecastTrendSchema,
    evidenceStrength: ForecastEvidenceStrengthSchema,
    evidence: z
      .object({
        sessionCount: z.number().int().positive(),
        weeksTracked: z.number().int().positive(),
        spanDays: z.number().int().nonnegative(),
        averageRpe: z.number().finite().min(1).max(10).nullable(),
        observedWeeklyChangeKg: z.number().finite(),
      })
      .strict(),
  })
  .strict();

export type DeterministicLiftForecast = z.infer<typeof DeterministicLiftForecastSchema>;

export const DeterministicPerformanceForecastSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("ready"),
      forecastVersion: z.literal("1.0"),
      sourceWindowDays: z.literal(120),
      lifts: z.array(DeterministicLiftForecastSchema).min(1).max(6),
    })
    .strict(),
  z
    .object({
      status: z.literal("learning"),
      forecastVersion: z.literal("1.0"),
      sourceWindowDays: z.literal(120),
      eligibleLiftCount: z.number().int().nonnegative(),
      minimumSessionCount: z.literal(4),
      minimumSpanDays: z.literal(21),
      lifts: z.array(DeterministicLiftForecastSchema).length(0),
    })
    .strict(),
]);

export type DeterministicPerformanceForecast = z.infer<
  typeof DeterministicPerformanceForecastSchema
>;
