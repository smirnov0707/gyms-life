import { describe, expect, it } from "vitest";
import { AthletePredictionSchema } from "./prediction.schema";
import {
  evaluateWorkoutCompletionShadowPrediction,
  isWorkoutCompletionShadowEligibleAction,
} from "./prediction-shadow-ledger";

function pendingPrediction() {
  return AthletePredictionSchema.parse({
    id: "550e8400-e29b-41d4-a716-446655440000",
    target: "workout_completion",
    generatedAt: "2026-09-05T08:00:00+03:00",
    horizonEndsAt: "2026-09-06T00:00:00+03:00",
    modelId: "workout-completion-usual-day-baseline",
    modelVersion: "0.1.0",
    maturity: "shadow",
    athleteStateSnapshotId: "550e8400-e29b-41d4-a716-446655440001",
    evidenceLevel: "moderate",
    evidence: [],
    predicted: { kind: "probability", value: 0.75 },
    actual: null,
    evaluatedAt: null,
  });
}

describe("prediction shadow ledger", () => {
  it("captures only decisions that actually recommend training", () => {
    expect(isWorkoutCompletionShadowEligibleAction("train_adapted")).toBe(true);
    expect(isWorkoutCompletionShadowEligibleAction("train_as_planned")).toBe(true);
    expect(isWorkoutCompletionShadowEligibleAction("recover")).toBe(false);
    expect(isWorkoutCompletionShadowEligibleAction("complete_readiness")).toBe(false);
  });

  it("observes completion immediately without waiting for the horizon", () => {
    const evaluated = evaluateWorkoutCompletionShadowPrediction({
      prediction: pendingPrediction(),
      actual: true,
      evaluatedAt: "2026-09-05T18:00:00+03:00",
    });

    expect(evaluated?.actual).toEqual({ kind: "boolean", value: true });
    expect(evaluated?.evaluatedAt).toBe("2026-09-05T18:00:00+03:00");
  });

  it("does not infer non-completion before the horizon", () => {
    expect(
      evaluateWorkoutCompletionShadowPrediction({
        prediction: pendingPrediction(),
        actual: false,
        evaluatedAt: "2026-09-05T23:59:59+03:00",
      }),
    ).toBeNull();
  });

  it("observes non-completion once the prediction horizon has elapsed", () => {
    const evaluated = evaluateWorkoutCompletionShadowPrediction({
      prediction: pendingPrediction(),
      actual: false,
      evaluatedAt: "2026-09-06T00:00:00+03:00",
    });

    expect(evaluated?.actual).toEqual({ kind: "boolean", value: false });
  });

  it("never overwrites already-observed history", () => {
    const observed = AthletePredictionSchema.parse({
      ...pendingPrediction(),
      actual: { kind: "boolean", value: true },
      evaluatedAt: "2026-09-05T18:00:00+03:00",
    });

    expect(
      evaluateWorkoutCompletionShadowPrediction({
        prediction: observed,
        actual: false,
        evaluatedAt: "2026-09-06T01:00:00+03:00",
      }),
    ).toBeNull();
  });

  it("refuses malformed prediction payloads instead of fabricating an outcome", () => {
    expect(
      evaluateWorkoutCompletionShadowPrediction({
        prediction: { target: "workout_completion", predicted: 0.75 },
        actual: true,
        evaluatedAt: "2026-09-05T18:00:00+03:00",
      }),
    ).toBeNull();
  });
});
