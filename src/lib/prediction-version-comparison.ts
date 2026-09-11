import { z } from "zod";
import type {
  PredictionCalibration,
  PredictionCalibrationModel,
} from "./prediction-calibration.schema";

export const PredictionVersionVerdictSchema = z.enum([
  "insufficient_evidence",
  "candidate_outperforms",
  "incumbent_outperforms",
  "equivalent",
  "mixed",
]);

const MetricDeltaSchema = z
  .object({
    brierScore: z.number().finite().nullable(),
    calibrationGap: z.number().finite().nullable(),
  })
  .strict();

export const PredictionVersionComparisonSchema = z
  .object({
    modelId: z.string().trim().min(1).max(120),
    incumbentVersion: z.string().trim().min(1).max(80),
    candidateVersion: z.string().trim().min(1).max(80),
    incumbentEvaluated: z.number().int().nonnegative(),
    candidateEvaluated: z.number().int().nonnegative(),
    verdict: PredictionVersionVerdictSchema,
    metricDelta: MetricDeltaSchema,
    automaticPromotionAllowed: z.literal(false),
  })
  .strict();

export type PredictionVersionComparison = z.infer<typeof PredictionVersionComparisonSchema>;
function hasMetrics(model: PredictionCalibrationModel): boolean {
  return (
    model.evaluated >= model.minimumEvaluated &&
    model.brierScore !== null &&
    model.calibrationGap !== null
  );
}

function comparePair(
  incumbent: PredictionCalibrationModel,
  candidate: PredictionCalibrationModel,
): PredictionVersionComparison {
  if (!hasMetrics(incumbent) || !hasMetrics(candidate)) {
    return PredictionVersionComparisonSchema.parse({
      modelId: incumbent.modelId,
      incumbentVersion: incumbent.modelVersion,
      candidateVersion: candidate.modelVersion,
      incumbentEvaluated: incumbent.evaluated,
      candidateEvaluated: candidate.evaluated,
      verdict: "insufficient_evidence",
      metricDelta: { brierScore: null, calibrationGap: null },
      automaticPromotionAllowed: false,
    });
  }

  const brierDelta = candidate.brierScore! - incumbent.brierScore!;
  const gapDelta = candidate.calibrationGap! - incumbent.calibrationGap!;
  const epsilon = 0.0005;
  const brierBetter = brierDelta < -epsilon;
  const gapBetter = gapDelta < -epsilon;
  const brierWorse = brierDelta > epsilon;
  const gapWorse = gapDelta > epsilon;
  const verdict =
    !brierWorse && !gapWorse && (brierBetter || gapBetter)
      ? "candidate_outperforms"
      : !brierBetter && !gapBetter && (brierWorse || gapWorse)
        ? "incumbent_outperforms"
        : !brierBetter && !gapBetter && !brierWorse && !gapWorse
          ? "equivalent"
          : "mixed";

  return PredictionVersionComparisonSchema.parse({
    modelId: incumbent.modelId,
    incumbentVersion: incumbent.modelVersion,
    candidateVersion: candidate.modelVersion,
    incumbentEvaluated: incumbent.evaluated,
    candidateEvaluated: candidate.evaluated,
    verdict,
    metricDelta: {
      brierScore: Math.round(brierDelta * 1000) / 1000,
      calibrationGap: Math.round(gapDelta * 1000) / 1000,
    },
    automaticPromotionAllowed: false,
  });
}

/** Compares adjacent versions of the same model only; version labels never imply quality. */
export function buildPredictionVersionComparisons(
  calibration: PredictionCalibration,
): PredictionVersionComparison[] {
  const byModel = new Map<string, PredictionCalibrationModel[]>();
  for (const model of calibration.models) {
    const group = byModel.get(model.modelId) ?? [];
    group.push(model);
    byModel.set(model.modelId, group);
  }

  return [...byModel.values()].flatMap((models) => {
    const ordered = [...models].sort((a, b) =>
      a.modelVersion.localeCompare(b.modelVersion, undefined, { numeric: true }),
    );
    return ordered.slice(1).map((candidate, index) => comparePair(ordered[index]!, candidate));
  });
}
