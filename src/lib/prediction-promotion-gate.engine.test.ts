import { describe, expect, it } from "vitest";
import { PredictionCalibrationSchema } from "./prediction-calibration.schema";
import { buildPredictionPromotionGate } from "./prediction-promotion-gate.engine";
import {
  MAX_CALIBRATION_GAP_FOR_CANARY_REVIEW,
  MINIMUM_BRIER_SKILL_FOR_CANARY_REVIEW,
  MINIMUM_EVALUATED_PREDICTIONS_FOR_CANARY_REVIEW,
} from "./prediction-promotion-gate.schema";

function calibrationModel(overrides?: {
  evaluated?: number;
  observedCompletionRate?: number | null;
  calibrationGap?: number | null;
  brierScore?: number | null;
}) {
  const evaluated = overrides?.evaluated ?? 30;
  return PredictionCalibrationSchema.parse({
    target: "workout_completion",
    maturity: "shadow",
    totalCaptured: evaluated,
    totalEvaluated: evaluated,
    totalPending: 0,
    minimumEvaluated: 8,
    models: [
      {
        modelId: "candidate-model",
        modelVersion: "1.0.0",
        captured: evaluated,
        evaluated,
        pending: 0,
        minimumEvaluated: 8,
        meanPredictedProbability: 0.6,
        observedCompletionRate: overrides?.observedCompletionRate ?? 0.6,
        calibrationGap: overrides?.calibrationGap ?? 0.05,
        brierScore: overrides?.brierScore ?? 0.2,
      },
    ],
  });
}

describe("buildPredictionPromotionGate", () => {
  it("gathers evidence until the stricter canary-review sample threshold is met", () => {
    const report = buildPredictionPromotionGate(
      calibrationModel({ evaluated: MINIMUM_EVALUATED_PREDICTIONS_FOR_CANARY_REVIEW - 1 }),
    );

    expect(report.models[0]?.status).toBe("gathering_evidence");
    expect(report.models[0]?.sampleSizeCheck.passed).toBe(false);
    expect(report.models[0]?.autoPromotion).toBe(false);
  });

  it("marks a calibrated, skillful shadow model eligible only for manual review", () => {
    const report = buildPredictionPromotionGate(calibrationModel());
    const gate = report.models[0];

    expect(gate?.status).toBe("eligible_for_manual_review");
    expect(gate?.autoPromotion).toBe(false);
    expect(gate?.candidateMaturity).toBe("canary");
    expect(gate?.calibrationCheck.maximumGap).toBe(MAX_CALIBRATION_GAP_FOR_CANARY_REVIEW);
    expect(gate?.skillCheck.minimumSkillScore).toBe(MINIMUM_BRIER_SKILL_FOR_CANARY_REVIEW);
    expect(gate?.skillCheck.referenceBrierScore).toBe(0.24);
    expect(gate?.skillCheck.brierSkillScore).toBe(0.167);
  });

  it("holds a model whose calibration gap exceeds the policy limit", () => {
    const report = buildPredictionPromotionGate(
      calibrationModel({ calibrationGap: MAX_CALIBRATION_GAP_FOR_CANARY_REVIEW + 0.01 }),
    );

    expect(report.models[0]?.status).toBe("hold");
    expect(report.models[0]?.calibrationCheck.passed).toBe(false);
  });

  it("holds a model that does not beat the empirical prevalence reference", () => {
    const report = buildPredictionPromotionGate(calibrationModel({ brierScore: 0.24 }));

    expect(report.models[0]?.status).toBe("hold");
    expect(report.models[0]?.skillCheck.brierSkillScore).toBe(0);
    expect(report.models[0]?.skillCheck.passed).toBe(false);
  });

  it("holds promotion when all observed outcomes are identical", () => {
    const report = buildPredictionPromotionGate(
      calibrationModel({
        observedCompletionRate: 1,
        calibrationGap: 0,
        brierScore: 0,
      }),
    );

    expect(report.models[0]?.status).toBe("hold");
    expect(report.models[0]?.outcomeVariationCheck.passed).toBe(false);
    expect(report.models[0]?.skillCheck.referenceBrierScore).toBeNull();
    expect(report.models[0]?.skillCheck.brierSkillScore).toBeNull();
  });

  it("never mutates maturity even when every gate passes", () => {
    const calibration = calibrationModel();
    const report = buildPredictionPromotionGate(calibration);

    expect(calibration.maturity).toBe("shadow");
    expect(report.sourceMaturity).toBe("shadow");
    expect(report.candidateMaturity).toBe("canary");
    expect(report.autoPromotion).toBe(false);
  });
});
