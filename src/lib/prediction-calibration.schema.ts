import { z } from "zod";

export const MINIMUM_EVALUATED_PREDICTIONS_FOR_CALIBRATION = 8;

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
