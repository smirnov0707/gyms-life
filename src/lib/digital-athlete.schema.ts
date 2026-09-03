import { z } from "zod";
import { ActiveLifeContextSchema } from "./life-context.schema";
import {
  TrainingRhythmSchema,
  TrainingWeekdayListSchema,
  TrainingWeekdaySchema,
} from "./training-rhythm.schema";
import { WorkoutFeelingSchema } from "./workout-reflection.schema";

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

/**
 * A separate optional source keeps an invalid legacy reflection from
 * invalidating the canonical completed-workout source or a Today decision.
 */
export const WorkoutResponseSourceSchema = z
  .object({
    started_at: TimestampSchema,
    feeling: WorkoutFeelingSchema.nullable(),
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

/**
 * An explicit result of a prior Today recommendation. This is intentionally
 * distinct from a workout result: it measures whether the recommendation fit
 * the athlete's day, not whether the athlete made progress.
 */
export const DecisionFeedbackSourceSchema = z
  .object({
    decision_on: DaySchema,
    outcome: z.enum(["accepted", "dismissed", "completed", "not_helpful"]),
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
    workoutResponses: z.array(WorkoutResponseSourceSchema),
    checkins: z.array(DailyCheckinSourceSchema),
    bodyMetrics: z.array(BodyMetricSourceSchema),
    nutritionLogs: z.array(NutritionLogSourceSchema),
    decisionFeedback: z.array(DecisionFeedbackSourceSchema),
    lifeContexts: z.array(ActiveLifeContextSchema),
    trainingRhythm: TrainingRhythmSchema.nullable(),
    availability: BaseAvailabilitySchema.extend({
      nutrition: z.boolean(),
      decisionFeedback: z.boolean(),
      context: z.boolean(),
      trainingRhythm: z.boolean(),
      trainingResponse: z.boolean(),
    }).strict(),
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
  "current_context_unavailable",
  "training_rhythm_data_unavailable",
  "personalization_consent_required",
  "personalization_consent_unavailable",
]);

export type DigitalAthleteDataGap = z.infer<typeof DigitalAthleteDataGapSchema>;

/**
 * A factual comparison of completed workout days with a user's optional
 * rhythm. It never treats a non-usual day as a failure or a usual day as a
 * required session; the values only describe observed schedule fit.
 */
export const TrainingBehaviorSchema = z
  .discriminatedUnion("status", [
    z
      .object({
        status: z.literal("measured"),
        preferredWeekdays: TrainingWeekdayListSchema,
        usualTrainingDaysLast28Days: z.number().int().positive().max(28),
        completedUsualTrainingDaysLast28Days: z.number().int().nonnegative().max(28),
        completedFlexibleTrainingDaysLast28Days: z.number().int().nonnegative().max(28),
        usualDayCompletionRateLast28Days: z.number().finite().min(0).max(1),
      })
      .strict(),
    z
      .object({
        status: z.enum(["not_configured", "unavailable"]),
        preferredWeekdays: z.array(TrainingWeekdaySchema).length(0),
        usualTrainingDaysLast28Days: z.null(),
        completedUsualTrainingDaysLast28Days: z.null(),
        completedFlexibleTrainingDaysLast28Days: z.null(),
        usualDayCompletionRateLast28Days: z.null(),
      })
      .strict(),
  ])
  .superRefine((value, context) => {
    if (
      value.status === "measured" &&
      value.completedUsualTrainingDaysLast28Days > value.usualTrainingDaysLast28Days
    ) {
      context.addIssue({
        code: "custom",
        message: "Completed usual days cannot exceed the available usual days.",
        path: ["completedUsualTrainingDaysLast28Days"],
      });
    }
    if (value.status === "measured") {
      const expectedRate =
        Math.round(
          (value.completedUsualTrainingDaysLast28Days / value.usualTrainingDaysLast28Days) * 100,
        ) / 100;
      if (value.usualDayCompletionRateLast28Days !== expectedRate) {
        context.addIssue({
          code: "custom",
          message: "Usual-day completion rate must match the counted training days.",
          path: ["usualDayCompletionRateLast28Days"],
        });
      }
    }
  });

export type TrainingBehavior = z.infer<typeof TrainingBehaviorSchema>;

/**
 * Current local-day facts are calculated with the same time-zone boundary as
 * the rest of the athlete state. They prevent a separate Today query path
 * from disagreeing with the persisted athlete snapshot.
 */
export const CurrentDayStateSchema = z
  .object({
    day: DaySchema,
    weekday: TrainingWeekdaySchema,
    hasCompletedReadiness: z.boolean(),
    hasCompletedWorkout: z.boolean(),
    hasLoggedNutrition: z.boolean(),
  })
  .strict();

export type CurrentDayState = z.infer<typeof CurrentDayStateSchema>;

export const DigitalAthleteStateSchema = z
  .object({
    schemaVersion: z.literal("1.5"),
    training: z.object({
      sessionsLast7Days: z.number().int().nonnegative(),
      sessionsLast28Days: z.number().int().nonnegative(),
      totalVolumeLast28Days: NonNegativeNumberSchema,
      daysSinceLastCompletedWorkout: z.number().int().nonnegative().nullable(),
      selfReportedResponse: z
        .object({
          source: z.literal("user_reported"),
          available: z.boolean(),
          ratedSessionsLast28Days: z.number().int().nonnegative(),
          latestFeeling: WorkoutFeelingSchema.nullable(),
          averageFeelingLast28Days: z.number().finite().min(1).max(5).nullable(),
        })
        .strict(),
    }),
    recovery: z.object({
      checkinsLast7Days: z.number().int().nonnegative(),
      latestReadinessScore: z.number().finite().min(0).max(100).nullable(),
      averageReadinessLast7Days: z.number().finite().min(0).max(100).nullable(),
      averageSleepHoursLast7Days: z.number().finite().min(0).max(24).nullable(),
    }),
    body: z.object({
      measurementsLast30Days: z.number().int().nonnegative(),
      latestWeightKg: NonNegativeNumberSchema.nullable(),
      latestBodyFatPercent: z.number().finite().min(0).max(100).nullable(),
      weightChangeKgLast30Days: z.number().finite().nullable(),
    }),
    nutrition: z.object({
      loggedDaysLast14Days: z.number().int().nonnegative(),
      averageCaloriesOnLoggedDays: NonNegativeNumberSchema.nullable(),
      averageProteinGOnLoggedDays: NonNegativeNumberSchema.nullable(),
    }),
    currentDay: CurrentDayStateSchema,
    behavior: TrainingBehaviorSchema,
    decisionFeedback: z
      .object({
        available: z.boolean(),
        ratedDecisionsLast28Days: z.number().int().nonnegative(),
        helpfulDecisionOutcomesLast28Days: z.number().int().nonnegative(),
        notHelpfulDecisionOutcomesLast28Days: z.number().int().nonnegative(),
        helpfulnessRate: z.number().finite().min(0).max(1).nullable(),
      })
      .strict(),
    currentContext: z
      .object({
        active: z.array(ActiveLifeContextSchema).max(12),
        shortestAvailableSessionMinutes: z.number().int().min(10).max(180).nullable(),
        hasTrainingConstraint: z.boolean(),
        hasSafetyConstraint: z.boolean(),
      })
      .strict(),
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
