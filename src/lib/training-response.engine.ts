import {
  MIN_CONSECUTIVE_LOW_FEELINGS_FOR_GUARD,
  MIN_RATED_SESSIONS_FOR_TRAINING_RESPONSE_GUARD,
  TRAINING_RESPONSE_VOLUME_MODIFIER,
  TrainingResponseStateSchema,
  TrainingResponseVolumeGuardSchema,
  type TrainingResponseState,
  type TrainingResponseVolumeGuard,
} from "./training-response.schema";

/**
 * Resolves a short-lived safety guard from user-reported session feedback.
 * This does not rewrite a training plan, calculate readiness, or invoke an
 * AI provider. It only supplies a bounded volume modifier for the next
 * execution snapshot once there is enough repeated evidence.
 */
export function resolveTrainingResponseVolumeGuard(
  value: TrainingResponseState,
): TrainingResponseVolumeGuard {
  const response = TrainingResponseStateSchema.parse(value);
  const hasEnoughRatedSessions =
    response.available &&
    response.ratedSessionsLast28Days >= MIN_RATED_SESSIONS_FOR_TRAINING_RESPONSE_GUARD;
  const hasRepeatedLowFeelings =
    response.recentLowFeelingStreak >= MIN_CONSECUTIVE_LOW_FEELINGS_FOR_GUARD;

  if (hasEnoughRatedSessions && hasRepeatedLowFeelings) {
    return TrainingResponseVolumeGuardSchema.parse({
      status: "temporary_reduced_volume",
      volumeModifier: TRAINING_RESPONSE_VOLUME_MODIFIER,
      ratedSessionsLast28Days: response.ratedSessionsLast28Days,
      recentLowFeelingStreak: response.recentLowFeelingStreak,
    });
  }

  return TrainingResponseVolumeGuardSchema.parse({
    status: "not_active",
    volumeModifier: 1,
    ratedSessionsLast28Days: response.ratedSessionsLast28Days,
    recentLowFeelingStreak: response.recentLowFeelingStreak,
  });
}
