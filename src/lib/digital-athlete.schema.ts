import { z } from "zod";

const TimestampSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => Number.isFinite(Date.parse(value)), "Expected a valid timestamp.");

const DaySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) => Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)),
    "Expected a valid day.",
  );

const NonNegativeNumberSchema = z.number().finite().min(0);

export const CompletedWorkoutSourceSchema = z
  .object({
    started_at: TimestampSchema,
    total_volume: NonNegativeNumberSchema,
  })
  .strict();

export const DailyCheckinSourceSchema = z
  .object({
    checkin_on: DaySchema,
    readiness_score: z.number().finite().min(0).max(100).nullable(),
    sleep_hours: z.number().finite().min(0).max(24).nullable(),
  })
  .strict();

export const BodyMetricSourceSchema = z
  .object({
    measured_on: DaySchema,
    weight_kg: NonNegativeNumberSchema.nullable(),
    body_fat: z.number().finite().min(0).max(100).nullable(),
  })
  .strict();

export const NutritionLogSourceSchema = z
  .object({
    logged_on: DaySchema,
    calories: NonNegativeNumberSchema,
    protein: NonNegativeNumberSchema,
  })
  .strict();

const BaseAvailabilitySchema = z
  .object({
    training: z.boolean(),
    recovery: z.boolean(),
    body: z.boolean(),
  })
  .strict();

/**
 * The narrow, validated input contract used by existing AI summaries. It is
 * intentionally made only of aggregates-safe source fields, never full rows.
 */
export const AiPersonalizationSourcesSchema = z
  .object({
    workouts: z.array(CompletedWorkoutSourceSchema),
    checkins: z.array(DailyCheckinSourceSchema),
    bodyMetrics: z.array(BodyMetricSourceSchema),
    availability: BaseAvailabilitySchema,
  })
  .strict();

export type AiPersonalizationSources = z.infer<typeof AiPersonalizationSourcesSchema>;

export const DigitalAthleteSourcesSchema = z
  .object({
    workouts: z.array(CompletedWorkoutSourceSchema),
    checkins: z.array(DailyCheckinSourceSchema),
    bodyMetrics: z.array(BodyMetricSourceSchema),
    nutritionLogs: z.array(NutritionLogSourceSchema),
    availability: BaseAvailabilitySchema.extend({ nutrition: z.boolean() }).strict(),
  })
  .strict();

export type DigitalAthleteSources = z.infer<typeof DigitalAthleteSourcesSchema>;

export const DigitalAthleteDataGapSchema = z.enum([
  "training_data_unavailable",
  "no_completed_workouts_28d",
  "recovery_data_unavailable",
  "no_recovery_checkins_7d",
  "body_measurements_unavailable",
  "no_body_measurements_30d",
  "nutrition_data_unavailable",
  "no_nutrition_logs_14d",
  "personalization_consent_required",
  "personalization_consent_unavailable",
]);

export type DigitalAthleteDataGap = z.infer<typeof DigitalAthleteDataGapSchema>;

export const DigitalAthleteStateSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    training: z.object({
      sessionsLast7Days: z.number().int().nonnegative(),
      sessionsLast28Days: z.number().int().nonnegative(),
      totalVolumeLast28Days: NonNegativeNumberSchema,
      daysSinceLastCompletedWorkout: z.number().int().nonnegative().nullable(),
    }),
    recovery: z.object({
      latestReadinessScore: z.number().finite().min(0).max(100).nullable(),
      averageReadinessLast7Days: z.number().finite().min(0).max(100).nullable(),
      averageSleepHoursLast7Days: z.number().finite().min(0).max(24).nullable(),
    }),
    body: z.object({
      latestWeightKg: NonNegativeNumberSchema.nullable(),
      latestBodyFatPercent: z.number().finite().min(0).max(100).nullable(),
      weightChangeKgLast30Days: z.number().finite().nullable(),
    }),
    nutrition: z.object({
      loggedDaysLast14Days: z.number().int().nonnegative(),
      averageCaloriesOnLoggedDays: NonNegativeNumberSchema.nullable(),
      averageProteinGOnLoggedDays: NonNegativeNumberSchema.nullable(),
    }),
    dataQuality: z.object({
      level: z.enum(["cold_start", "building", "informed"]),
      evidenceCount: z.number().int().nonnegative(),
      availableDomains: z.array(z.enum(["training", "recovery", "body", "nutrition"])),
    }),
    dataGaps: z.array(DigitalAthleteDataGapSchema),
  })
  .strict();

export type DigitalAthleteState = z.infer<typeof DigitalAthleteStateSchema>;

/**
 * Re-validates DB select results at the Database -> domain boundary. An
 * invalid historical row invalidates only that source, never an AI request.
 */
export function parseDigitalAthleteRows<T>(
  schema: z.ZodType<T>,
  value: unknown,
): { rows: T[]; valid: boolean } {
  const parsed = z.array(schema).safeParse(value ?? []);
  return parsed.success ? { rows: parsed.data, valid: true } : { rows: [], valid: false };
}
