import { describe, expect, it } from "vitest";
import { PredictionCalibrationSchema } from "./prediction-calibration.schema";
import { buildPredictionPromotionReviews } from "./prediction-promotion-gate";

function calibration(
  evaluated: number,
  metrics: boolean,
  withheld:
    "insufficient_evidence" | "constant_forecast" | "constant_outcome" = "insufficient_evidence",
) {
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
        metricsWithheldBecause: metrics ? "none" : withheld,
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

  it("refuses a model that answered the same thing every time", () => {
    // The shadow model in production: 42 forecasts of `probability: 0` and 41
    // evaluated outcomes, every one `false`. Enough outcomes, nothing missing,
    // and nothing learned. Before this it reached a human reviewer as
    // review-eligible, with a calibration gap of 0% and a Brier score of 0.000
    // printed beside the words "0 means perfectly scored probability forecasts".
    const [review] = buildPredictionPromotionReviews(calibration(41, false, "constant_forecast"));
    expect(review).toMatchObject({
      eligibleForHumanReview: false,
      metricsAvailable: false,
      automaticPromotionAllowed: false,
      blockers: ["calibration_metrics_withheld", "forecast_never_varied"],
    });
  });

  it("refuses a model whose outcomes never varied either", () => {
    // The other degenerate half: an outcome that never changes is scored
    // perfectly by always predicting it.
    const [review] = buildPredictionPromotionReviews(calibration(41, false, "constant_outcome"));
    expect(review?.blockers).toContain("outcome_never_varied");
    expect(review?.eligibleForHumanReview).toBe(false);
  });
});
