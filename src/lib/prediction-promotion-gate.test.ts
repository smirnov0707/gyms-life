import { describe, expect, it } from "vitest";
import { PredictionCalibrationSchema } from "./prediction-calibration.schema";
import { buildPredictionPromotionReviews } from "./prediction-promotion-gate";

function calibration(evaluated: number, metrics: boolean) {
  return PredictionCalibrationSchema.parse({
    target: "workout_completion",
    maturity: "shadow",
    totalCaptured: evaluated,
    totalEvaluated: evaluated,
    totalPending: 0,
    minimumEvaluated: 8,
    models: [
      {
        modelId: "completion",
        modelVersion: "1.0",
        captured: evaluated,
        evaluated,
        pending: 0,
        minimumEvaluated: 8,
        meanPredictedProbability: metrics ? 0.62 : null,
        observedCompletionRate: metrics ? 0.58 : null,
        calibrationGap: metrics ? 0.04 : null,
        brierScore: metrics ? 0.21 : null,
      },
    ],
  });
}
describe("prediction promotion review gate", () => {
  it("blocks review before the evaluated-outcome threshold", () => {
    const [review] = buildPredictionPromotionReviews(calibration(4, false));
    expect(review).toMatchObject({
      eligibleForHumanReview: false,
      automaticPromotionAllowed: false,
      blockers: ["insufficient_evaluated_outcomes", "calibration_metrics_withheld"],
    });
  });

  it("allows human review once calibration metrics exist, but never auto-promotes", () => {
    const [review] = buildPredictionPromotionReviews(calibration(8, true));
    expect(review).toMatchObject({
      eligibleForHumanReview: true,
      metricsAvailable: true,
      automaticPromotionAllowed: false,
      blockers: [],
    });
  });
});
