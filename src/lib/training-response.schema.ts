import { z } from "zod";
import { WorkoutFeelingSchema } from "./workout-reflection.schema";

/**
 * A single difficult session is normal training feedback, not a reason to
 * change a user's plan. These thresholds deliberately require repeated,
 * recent, user-reported evidence before a temporary volume guard can apply.
 */
export const LOW_WORKOUT_FEELING_THRESHOLD = 2;
export const MIN_RATED_SESSIONS_FOR_TRAINING_RESPONSE_GUARD = 4;
export const MIN_CONSECUTIVE_LOW_FEELINGS_FOR_GUARD = 3;
export const TRAINING_RESPONSE_VOLUME_MODIFIER = 0.8;

export const TrainingResponseStateSchema = z
  .object({
    source: z.literal("user_reported"),
    available: z.boolean(),
    ratedSessionsLast28Days: z.number().int().nonnegative(),
    latestFeeling: WorkoutFeelingSchema.nullable(),
    averageFeelingLast28Days: z.number().finite().min(1).max(5).nullable(),
    recentLowFeelingStreak: z.number().int().nonnegative().max(60),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.available) {
      if (value.ratedSessionsLast28Days !== 0) {
        context.addIssue({
          code: "custom",
          message: "Unavailable workout-response data cannot report rated sessions.",
          path: ["ratedSessionsLast28Days"],
        });
      }
      if (value.latestFeeling !== null || value.averageFeelingLast28Days !== null) {
        context.addIssue({
          code: "custom",
          message: "Unavailable workout-response data cannot report response values.",
          path: ["latestFeeling"],
        });
      }
      if (value.recentLowFeelingStreak !== 0) {
        context.addIssue({
          code: "custom",
          message: "Unavailable workout-response data cannot report a low-feeling streak.",
          path: ["recentLowFeelingStreak"],
        });
      }
    }
    if (value.recentLowFeelingStreak > value.ratedSessionsLast28Days) {
      context.addIssue({
        code: "custom",
        message: "Low-feeling streak cannot exceed rated sessions.",
        path: ["recentLowFeelingStreak"],
      });
    }
    if (value.available && value.ratedSessionsLast28Days === 0) {
      if (
        value.latestFeeling !== null ||
        value.averageFeelingLast28Days !== null ||
        value.recentLowFeelingStreak !== 0
      ) {
        context.addIssue({
          code: "custom",
          message: "No rated sessions cannot produce a response summary.",
          path: ["ratedSessionsLast28Days"],
        });
      }
    }
    if (
      value.available &&
      value.ratedSessionsLast28Days > 0 &&
      (value.latestFeeling === null || value.averageFeelingLast28Days === null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Rated sessions require a latest and average response value.",
        path: ["latestFeeling"],
      });
    }
    if (
      value.latestFeeling !== null &&
      value.latestFeeling > LOW_WORKOUT_FEELING_THRESHOLD &&
      value.recentLowFeelingStreak !== 0
    ) {
      context.addIssue({
        code: "custom",
        message: "A non-low latest feeling ends the low-feeling streak.",
        path: ["recentLowFeelingStreak"],
      });
    }
    if (
      value.latestFeeling !== null &&
      value.latestFeeling <= LOW_WORKOUT_FEELING_THRESHOLD &&
      value.recentLowFeelingStreak === 0
    ) {
      context.addIssue({
        code: "custom",
        message: "A low latest feeling starts a low-feeling streak.",
        path: ["recentLowFeelingStreak"],
      });
    }
  });

export type TrainingResponseState = z.infer<typeof TrainingResponseStateSchema>;

export const TrainingResponseVolumeGuardSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("not_active"),
      volumeModifier: z.literal(1),
      ratedSessionsLast28Days: z.number().int().nonnegative(),
      recentLowFeelingStreak: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      status: z.literal("temporary_reduced_volume"),
      volumeModifier: z.literal(TRAINING_RESPONSE_VOLUME_MODIFIER),
      ratedSessionsLast28Days: z.number().int().min(MIN_RATED_SESSIONS_FOR_TRAINING_RESPONSE_GUARD),
      recentLowFeelingStreak: z.number().int().min(MIN_CONSECUTIVE_LOW_FEELINGS_FOR_GUARD),
    })
    .strict(),
]);

export type TrainingResponseVolumeGuard = z.infer<typeof TrainingResponseVolumeGuardSchema>;
