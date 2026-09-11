import { z } from "zod";
import type { PredictionCalibration } from "./prediction-calibration.schema";

export const PredictionPromotionBlockerSchema = z.enum([
  "insufficient_evaluated_outcomes",
  "calibration_metrics_withheld",
]);

export const PredictionPromotionReviewSchema = z
  .object({
    modelId: z.string().trim().min(1).max(120),
    modelVersion: z.string().trim().min(1).max(80),
    evaluatedOutcomes: z.number().int().nonnegative(),
    minimumEvaluated: z.number().int().positive(),
    metricsAvailable: z.boolean(),
    eligibleForHumanReview: z.boolean(),
    automaticPromotionAllowed: z.literal(false),
    blockers: z.array(PredictionPromotionBlockerSchema),
  })
  .strict();

export type PredictionPromotionReview = z.infer<typeof PredictionPromotionReviewSchema>;
export function buildPredictionPromotionReviews(
  calibration: PredictionCalibration,
): PredictionPromotionReview[] {
  return calibration.models.map((model) => {
    const blockers: z.infer<typeof PredictionPromotionBlockerSchema>[] = [];
    const enoughOutcomes = model.evaluated >= model.minimumEvaluated;
    const metricsAvailable =
      model.meanPredictedProbability !== null &&
      model.observedCompletionRate !== null &&
      model.calibrationGap !== null &&
      model.brierScore !== null;

    if (!enoughOutcomes) blockers.push("insufficient_evaluated_outcomes");
    if (!metricsAvailable) blockers.push("calibration_metrics_withheld");

    return PredictionPromotionReviewSchema.parse({
      modelId: model.modelId,
      modelVersion: model.modelVersion,
      evaluatedOutcomes: model.evaluated,
      minimumEvaluated: model.minimumEvaluated,
      metricsAvailable,
      eligibleForHumanReview: blockers.length === 0,
      automaticPromotionAllowed: false,
      blockers,
    });
  });
}
