import { AthletePredictionSchema, type AthletePrediction } from "./prediction.schema";
import type { TodayDecisionAction } from "./today-decision.schema";

/**
 * Shadow predictions are evidence collection only. Eligibility here must never
 * be used to choose or alter a Today action.
 */
export function isWorkoutCompletionShadowEligibleAction(action: TodayDecisionAction): boolean {
  return action === "train_adapted" || action === "train_as_planned";
}

/**
 * Turns one pending shadow forecast into an immutable observed result.
 *
 * A successful workout may be observed before the prediction horizon ends.
 * A negative result is observable only once the horizon has elapsed; before
 * then, absence of completion is not evidence of non-completion.
 *
 * Returning null means "do not mutate stored history". This includes invalid,
 * non-shadow, non-workout and already-evaluated prediction payloads.
 */
export function evaluateWorkoutCompletionShadowPrediction(input: {
  prediction: unknown;
  actual: boolean;
  evaluatedAt: string;
}): AthletePrediction | null {
  const parsed = AthletePredictionSchema.safeParse(input.prediction);
  if (!parsed.success) return null;

  const prediction = parsed.data;
  if (prediction.target !== "workout_completion" || prediction.maturity !== "shadow") return null;
  if (prediction.actual !== null || prediction.evaluatedAt !== null) return null;

  const evaluatedAtMs = Date.parse(input.evaluatedAt);
  if (Number.isNaN(evaluatedAtMs) || evaluatedAtMs < Date.parse(prediction.generatedAt)) return null;
  if (!input.actual && evaluatedAtMs < Date.parse(prediction.horizonEndsAt)) return null;

  return AthletePredictionSchema.parse({
    ...prediction,
    actual: { kind: "boolean", value: input.actual },
    evaluatedAt: input.evaluatedAt,
  });
}
