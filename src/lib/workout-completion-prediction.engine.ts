import type { DigitalAthleteState } from "./digital-athlete.schema";
import { IntelligenceModelDescriptorSchema } from "./model-registry.schema";
import type { AthletePrediction } from "./prediction.schema";

export const WORKOUT_COMPLETION_BASELINE_MODEL = IntelligenceModelDescriptorSchema.parse({
  modelId: "workout-completion-usual-day-baseline",
  version: "0.1.0",
  type: "statistical",
  status: "shadow",
  targets: ["workout_completion"],
  inputContractVersion: "digital-athlete-1.7",
  outputContractVersion: "prediction-1",
  description:
    "Transparent usual-training-day completion baseline used only to validate prediction plumbing and calibration.",
});

export const MIN_USUAL_DAYS_FOR_COMPLETION_PREDICTION = 4;

export type WorkoutCompletionPredictionInput = {
  predictionId: string;
  generatedAt: string;
  horizonEndsAt: string;
  athleteStateSnapshotId: string | null;
  state: DigitalAthleteState;
  /** The prediction is meaningful only when Today actually proposes training. */
  workoutRecommendedToday: boolean;
};

/**
 * First Future Lab prediction model: deliberately a transparent baseline.
 *
 * It predicts only on a configured usual training day, only when Today has
 * actually recommended a workout, and only after enough observable usual-day
 * history exists. It does not infer physiology and never affects the decision.
 * Future models must beat this baseline before promotion.
 */
export function predictWorkoutCompletion(
  input: WorkoutCompletionPredictionInput,
): AthletePrediction | null {
  if (!input.workoutRecommendedToday) return null;

  const behavior = input.state.behavior;
  if (behavior.status !== "measured") return null;
  if (!behavior.preferredWeekdays.includes(input.state.currentDay.weekday)) return null;
  if (behavior.usualTrainingDaysLast28Days < MIN_USUAL_DAYS_FOR_COMPLETION_PREDICTION) return null;

  const evidenceLevel =
    behavior.usualTrainingDaysLast28Days >= 12
      ? "strong"
      : behavior.usualTrainingDaysLast28Days >= 8
        ? "moderate"
        : "early";

  return {
    id: input.predictionId,
    target: "workout_completion",
    generatedAt: input.generatedAt,
    horizonEndsAt: input.horizonEndsAt,
    modelId: WORKOUT_COMPLETION_BASELINE_MODEL.modelId,
    modelVersion: WORKOUT_COMPLETION_BASELINE_MODEL.version,
    maturity: "shadow",
    athleteStateSnapshotId: input.athleteStateSnapshotId,
    evidenceLevel,
    evidence: [],
    predicted: {
      kind: "probability",
      value: behavior.usualDayCompletionRateLast28Days,
    },
    actual: null,
    evaluatedAt: null,
  };
}
