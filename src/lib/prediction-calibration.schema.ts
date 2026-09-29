import { z } from "zod";

export const MINIMUM_EVALUATED_PREDICTIONS_FOR_CALIBRATION = 8;

/**
 * Why a model's calibration metrics are not shown.
 *
 * The threshold above counts observations, and a count is not variation.
 * Production holds 42 shadow forecasts for `workout_completion`, every one of
 * them `probability: 0`, against 41 evaluated outcomes, every one of them
 * `false`. That is one observation repeated 41 times. It scores a calibration
 * gap of 0 and a Brier score of 0.000 — the best values either metric can take
 * — and the panel prints them under the words "0 means perfectly scored
 * probability forecasts", for a model that has never once made a distinction.
 *
 * Both metrics are arithmetically correct and neither measures skill: a
 * constant forecast has no behaviour to score, and a constant outcome can be
 * scored perfectly by predicting the constant. PART LXXV calls fabricated
 * confidence out by name, and a perfect score nobody earned is exactly that.
 */
export const CalibrationWithholdingSchema = z.enum([
  "none",
  "insufficient_evidence",
  "constant_forecast",
  "constant_outcome",
]);

export type CalibrationWithholding = z.infer<typeof CalibrationWithholdingSchema>;

export const PredictionCalibrationModelSchema = z
  .object({
    modelId: z.string().trim().min(1).max(120),
    modelVersion: z.string().trim().min(1).max(80),
    captured: z.number().int().nonnegative(),
    evaluated: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
    minimumEvaluated: z.number().int().positive(),
    meanPredictedProbability: z.number().min(0).max(1).nullable(),
    observedCompletionRate: z.number().min(0).max(1).nullable(),
    calibrationGap: z.number().min(0).max(1).nullable(),
    brierScore: z.number().min(0).max(1).nullable(),
    metricsWithheldBecause: CalibrationWithholdingSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.evaluated + value.pending !== value.captured) {
      context.addIssue({
        code: "custom",
        message: "Evaluated and pending predictions must equal captured predictions.",
        path: ["captured"],
      });
    }

    const metrics = [
      value.meanPredictedProbability,
      value.observedCompletionRate,
      value.calibrationGap,
      value.brierScore,
    ];
    const metricsAvailable = metrics.every((metric) => metric !== null);
    const metricsWithheld = metrics.every((metric) => metric === null);
    if (!metricsAvailable && !metricsWithheld) {
      context.addIssue({
        code: "custom",
        message: "Calibration metrics must be present or withheld as one set.",
        path: ["brierScore"],
      });
    }
    if (value.evaluated < value.minimumEvaluated && !metricsWithheld) {
      context.addIssue({
        code: "custom",
        message: "Calibration metrics must be withheld below the evidence threshold.",
        path: ["evaluated"],
      });
    }
    // The reason and the numbers must agree. A model reporting a score while
    // naming a reason it cannot be scored is worse than either alone, and a
    // model withholding its score for no stated reason is the silence this
    // whole field exists to remove.
    if (metricsWithheld !== (value.metricsWithheldBecause !== "none")) {
      context.addIssue({
        code: "custom",
        message:
          "Withheld calibration metrics must name a reason, and a reason must withhold them.",
        path: ["metricsWithheldBecause"],
      });
    }
  });

export const PredictionCalibrationSchema = z
  .object({
    target: z.literal("workout_completion"),
    maturity: z.literal("shadow"),
    totalCaptured: z.number().int().nonnegative(),
    totalEvaluated: z.number().int().nonnegative(),
    totalPending: z.number().int().nonnegative(),
    minimumEvaluated: z.number().int().positive(),
    models: z.array(PredictionCalibrationModelSchema).max(16),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.totalEvaluated + value.totalPending !== value.totalCaptured) {
      context.addIssue({
        code: "custom",
        message: "Prediction calibration totals are inconsistent.",
        path: ["totalCaptured"],
      });
    }
  });

export type PredictionCalibrationModel = z.infer<typeof PredictionCalibrationModelSchema>;
export type PredictionCalibration = z.infer<typeof PredictionCalibrationSchema>;
