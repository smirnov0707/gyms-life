import { describe, expect, it } from "vitest";
import { buildPredictionVersionComparisons } from "./prediction-version-comparison";
import type { PredictionCalibration } from "./prediction-calibration.schema";

function report(models: PredictionCalibration["models"]): PredictionCalibration {
  const totalCaptured = models.reduce((sum, model) => sum + model.captured, 0);
  const totalEvaluated = models.reduce((sum, model) => sum + model.evaluated, 0);
  return {
    target: "workout_completion",
    maturity: "shadow",
    totalCaptured,
    totalEvaluated,
    totalPending: totalCaptured - totalEvaluated,
    minimumEvaluated: 8,
    models,
  };
}

function model(version: string, brier: number | null, gap: number | null, evaluated = 8) {
  return {
    modelId: "completion",
    modelVersion: version,
    captured: evaluated,
    evaluated,
    pending: 0,
    minimumEvaluated: 8,
    meanPredictedProbability: brier === null ? null : 0.6,
    observedCompletionRate: brier === null ? null : 0.6,
    calibrationGap: gap,
    brierScore: brier,
  };
}
describe("prediction version comparison", () => {
  it("requires evidence on both versions", () => {
    const [comparison] = buildPredictionVersionComparisons(
      report([model("1.0.0", 0.2, 0.1), model("1.1.0", null, null, 4)]),
    );
    expect(comparison).toMatchObject({
      verdict: "insufficient_evidence",
      automaticPromotionAllowed: false,
    });
  });

  it("calls a candidate better only when neither calibration metric worsens", () => {
    const [comparison] = buildPredictionVersionComparisons(
      report([model("1.0.0", 0.24, 0.08), model("1.1.0", 0.18, 0.05)]),
    );
    expect(comparison).toMatchObject({
      verdict: "candidate_outperforms",
      metricDelta: { brierScore: -0.06, calibrationGap: -0.03 },
      automaticPromotionAllowed: false,
    });
  });

  it("keeps mixed evidence mixed rather than selecting a winner", () => {
    const [comparison] = buildPredictionVersionComparisons(
      report([model("1.0.0", 0.2, 0.04), model("1.1.0", 0.17, 0.07)]),
    );
    expect(comparison?.verdict).toBe("mixed");
  });
});
