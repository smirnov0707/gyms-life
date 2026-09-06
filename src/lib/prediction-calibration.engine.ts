import { AthletePredictionSchema, type AthletePrediction } from "./prediction.schema";
import {
  MINIMUM_EVALUATED_PREDICTIONS_FOR_CALIBRATION,
  PredictionCalibrationSchema,
  type PredictionCalibration,
  type PredictionCalibrationModel,
} from "./prediction-calibration.schema";

export type StoredPredictionCalibrationCandidate = {
  decisionOn: string;
  prediction: unknown;
};

type EligiblePrediction = {
  decisionOn: string;
  prediction: AthletePrediction;
};

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function eligiblePrediction(candidate: StoredPredictionCalibrationCandidate): EligiblePrediction | null {
  const parsed = AthletePredictionSchema.safeParse(candidate.prediction);
  if (!parsed.success) return null;
  if (parsed.data.target !== "workout_completion" || parsed.data.maturity !== "shadow") return null;
  if (parsed.data.predicted.kind !== "probability") return null;
  return { decisionOn: candidate.decisionOn, prediction: parsed.data };
}

/**
 * One workout-completion outcome is one statistical observation. If evolving
 * athlete snapshots produced several same-day forecasts from the same model
 * version, keep the earliest valid forecast so that day cannot be overweighted
 * in calibration and a later forecast cannot benefit from information that was
 * unavailable when the first actionable forecast was made.
 */
function uniquePredictionDays(
  candidates: StoredPredictionCalibrationCandidate[],
): EligiblePrediction[] {
  const unique = new Map<string, EligiblePrediction>();

  for (const candidate of candidates) {
    const eligible = eligiblePrediction(candidate);
    if (!eligible) continue;
    const prediction = eligible.prediction;
    const key = `${prediction.modelId}\u0000${prediction.modelVersion}\u0000${eligible.decisionOn}`;
    const previous = unique.get(key);
    if (!previous || Date.parse(prediction.generatedAt) < Date.parse(previous.prediction.generatedAt)) {
      unique.set(key, eligible);
    }
  }

  return [...unique.values()];
}

function buildModelCalibration(predictions: AthletePrediction[]): PredictionCalibrationModel {
  const [first] = predictions;
  if (!first) throw new Error("Cannot calibrate an empty model group.");

  const evaluated = predictions.flatMap((prediction) => {
    if (!prediction.actual || !prediction.evaluatedAt) return [];
    if (prediction.actual.kind !== "boolean" || prediction.predicted.kind !== "probability") return [];
    return [
      {
        predicted: prediction.predicted.value,
        actual: prediction.actual.value ? 1 : 0,
      },
    ];
  });

  const captured = predictions.length;
  const evaluatedCount = evaluated.length;
  const pending = captured - evaluatedCount;
  const enoughEvidence = evaluatedCount >= MINIMUM_EVALUATED_PREDICTIONS_FOR_CALIBRATION;

  if (!enoughEvidence) {
    return {
      modelId: first.modelId,
      modelVersion: first.modelVersion,
      captured,
      evaluated: evaluatedCount,
      pending,
      minimumEvaluated: MINIMUM_EVALUATED_PREDICTIONS_FOR_CALIBRATION,
      meanPredictedProbability: null,
      observedCompletionRate: null,
      calibrationGap: null,
      brierScore: null,
    };
  }

  const meanPredicted = evaluated.reduce((sum, item) => sum + item.predicted, 0) / evaluatedCount;
  const observedRate = evaluated.reduce((sum, item) => sum + item.actual, 0) / evaluatedCount;
  const brier =
    evaluated.reduce((sum, item) => sum + (item.predicted - item.actual) ** 2, 0) / evaluatedCount;

  return {
    modelId: first.modelId,
    modelVersion: first.modelVersion,
    captured,
    evaluated: evaluatedCount,
    pending,
    minimumEvaluated: MINIMUM_EVALUATED_PREDICTIONS_FOR_CALIBRATION,
    meanPredictedProbability: roundMetric(meanPredicted),
    observedCompletionRate: roundMetric(observedRate),
    calibrationGap: roundMetric(Math.abs(meanPredicted - observedRate)),
    brierScore: roundMetric(brier),
  };
}

/**
 * Builds a read-only calibration report from stored shadow forecasts.
 * Malformed/legacy rows and non-shadow targets are ignored. Model versions are
 * never pooled because calibration evidence for one version says nothing about
 * another version's reliability.
 */
export function buildPredictionCalibration(
  candidates: StoredPredictionCalibrationCandidate[],
): PredictionCalibration {
  const eligible = uniquePredictionDays(candidates);
  const groups = new Map<string, AthletePrediction[]>();

  for (const candidate of eligible) {
    const prediction = candidate.prediction;
    const key = `${prediction.modelId}\u0000${prediction.modelVersion}`;
    const group = groups.get(key) ?? [];
    group.push(prediction);
    groups.set(key, group);
  }

  const models = [...groups.values()]
    .map(buildModelCalibration)
    .sort((a, b) =>
      a.modelId === b.modelId
        ? a.modelVersion.localeCompare(b.modelVersion)
        : a.modelId.localeCompare(b.modelId),
    );

  const totalCaptured = models.reduce((sum, model) => sum + model.captured, 0);
  const totalEvaluated = models.reduce((sum, model) => sum + model.evaluated, 0);
  const totalPending = models.reduce((sum, model) => sum + model.pending, 0);

  return PredictionCalibrationSchema.parse({
    target: "workout_completion",
    maturity: "shadow",
    totalCaptured,
    totalEvaluated,
    totalPending,
    minimumEvaluated: MINIMUM_EVALUATED_PREDICTIONS_FOR_CALIBRATION,
    models,
  });
}
