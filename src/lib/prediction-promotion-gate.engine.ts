import type { PredictionCalibration } from "./prediction-calibration.schema";
import {
  MAX_CALIBRATION_GAP_FOR_CANARY_REVIEW,
  MINIMUM_BRIER_SKILL_FOR_CANARY_REVIEW,
  MINIMUM_EVALUATED_PREDICTIONS_FOR_CANARY_REVIEW,
  PREDICTION_PROMOTION_POLICY_VERSION,
  PredictionPromotionGateReportSchema,
  type PredictionPromotionGateModel,
  type PredictionPromotionGateReport,
} from "./prediction-promotion-gate.schema";

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function buildModelGate(model: PredictionCalibration["models"][number]): PredictionPromotionGateModel {
  const samplePassed = model.evaluated >= MINIMUM_EVALUATED_PREDICTIONS_FOR_CANARY_REVIEW;
  const observedRate = model.observedCompletionRate;
  const outcomeVariationPassed = observedRate !== null && observedRate > 0 && observedRate < 1;
  const calibrationPassed =
    model.calibrationGap !== null &&
    model.calibrationGap <= MAX_CALIBRATION_GAP_FOR_CANARY_REVIEW;

  const referenceBrierScore =
    outcomeVariationPassed && observedRate !== null
      ? roundMetric(observedRate * (1 - observedRate))
      : null;
  const brierSkillScore =
    referenceBrierScore !== null && referenceBrierScore > 0 && model.brierScore !== null
      ? roundMetric(1 - model.brierScore / referenceBrierScore)
      : null;
  const skillPassed =
    brierSkillScore !== null && brierSkillScore >= MINIMUM_BRIER_SKILL_FOR_CANARY_REVIEW;

  const allPassed = samplePassed && outcomeVariationPassed && calibrationPassed && skillPassed;
  const status = !samplePassed
    ? "gathering_evidence"
    : allPassed
      ? "eligible_for_manual_review"
      : "hold";

  return {
    modelId: model.modelId,
    modelVersion: model.modelVersion,
    currentMaturity: "shadow",
    candidateMaturity: "canary",
    status,
    autoPromotion: false,
    evaluated: model.evaluated,
    sampleSizeCheck: {
      actual: model.evaluated,
      required: MINIMUM_EVALUATED_PREDICTIONS_FOR_CANARY_REVIEW,
      passed: samplePassed,
    },
    outcomeVariationCheck: {
      observedCompletionRate: observedRate,
      passed: outcomeVariationPassed,
    },
    calibrationCheck: {
      actualGap: model.calibrationGap,
      maximumGap: MAX_CALIBRATION_GAP_FOR_CANARY_REVIEW,
      passed: calibrationPassed,
    },
    skillCheck: {
      brierScore: model.brierScore,
      referenceBrierScore,
      brierSkillScore,
      minimumSkillScore: MINIMUM_BRIER_SKILL_FOR_CANARY_REVIEW,
      passed: skillPassed,
    },
  };
}

/**
 * Evaluates whether a shadow model has enough evidence to be considered for a
 * human-controlled canary review. This function has no side effects and never
 * changes a registry status. Passing the gate is permission to review, not
 * permission to influence Today.
 *
 * Skill is measured against a constant empirical-prevalence forecast using the
 * Brier Skill Score. A positive configured margin is required so a candidate
 * must do more than barely tie that reference forecast.
 */
export function buildPredictionPromotionGate(
  calibration: PredictionCalibration,
): PredictionPromotionGateReport {
  return PredictionPromotionGateReportSchema.parse({
    target: calibration.target,
    sourceMaturity: "shadow",
    candidateMaturity: "canary",
    policyVersion: PREDICTION_PROMOTION_POLICY_VERSION,
    autoPromotion: false,
    models: calibration.models.map(buildModelGate),
  });
}
