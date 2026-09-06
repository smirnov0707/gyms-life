import { z } from "zod";

/**
 * Governance thresholds, not claims of scientific truth. They are deliberately
 * explicit and versioned so Future Lab cannot silently relax promotion rules.
 */
export const PREDICTION_PROMOTION_POLICY_VERSION = "1.0" as const;
export const MINIMUM_EVALUATED_PREDICTIONS_FOR_CANARY_REVIEW = 30;
export const MAX_CALIBRATION_GAP_FOR_CANARY_REVIEW = 0.1;
export const MINIMUM_BRIER_SKILL_FOR_CANARY_REVIEW = 0.05;

export const PredictionPromotionGateStatusSchema = z.enum([
  "gathering_evidence",
  "hold",
  "eligible_for_manual_review",
]);

export const PredictionPromotionGateModelSchema = z
  .object({
    modelId: z.string().trim().min(1).max(120),
    modelVersion: z.string().trim().min(1).max(80),
    currentMaturity: z.literal("shadow"),
    candidateMaturity: z.literal("canary"),
    status: PredictionPromotionGateStatusSchema,
    autoPromotion: z.literal(false),
    evaluated: z.number().int().nonnegative(),
    sampleSizeCheck: z
      .object({
        actual: z.number().int().nonnegative(),
        required: z.number().int().positive(),
        passed: z.boolean(),
      })
      .strict(),
    outcomeVariationCheck: z
      .object({
        observedCompletionRate: z.number().min(0).max(1).nullable(),
        passed: z.boolean(),
      })
      .strict(),
    calibrationCheck: z
      .object({
        actualGap: z.number().min(0).max(1).nullable(),
        maximumGap: z.number().min(0).max(1),
        passed: z.boolean(),
      })
      .strict(),
    skillCheck: z
      .object({
        brierScore: z.number().min(0).max(1).nullable(),
        referenceBrierScore: z.number().min(0).max(1).nullable(),
        brierSkillScore: z.number().max(1).nullable(),
        minimumSkillScore: z.number().max(1),
        passed: z.boolean(),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.sampleSizeCheck.actual !== value.evaluated) {
      context.addIssue({
        code: "custom",
        message: "Promotion sample-size check must match evaluated count.",
        path: ["sampleSizeCheck", "actual"],
      });
    }

    const allPassed =
      value.sampleSizeCheck.passed &&
      value.outcomeVariationCheck.passed &&
      value.calibrationCheck.passed &&
      value.skillCheck.passed;
    if (value.status === "eligible_for_manual_review" && !allPassed) {
      context.addIssue({
        code: "custom",
        message: "Manual review eligibility requires every promotion check to pass.",
        path: ["status"],
      });
    }
    if (value.status === "gathering_evidence" && value.sampleSizeCheck.passed) {
      context.addIssue({
        code: "custom",
        message: "Gathering-evidence status requires the sample-size gate to remain open.",
        path: ["status"],
      });
    }
  });

export const PredictionPromotionGateReportSchema = z
  .object({
    target: z.literal("workout_completion"),
    sourceMaturity: z.literal("shadow"),
    candidateMaturity: z.literal("canary"),
    policyVersion: z.literal(PREDICTION_PROMOTION_POLICY_VERSION),
    autoPromotion: z.literal(false),
    models: z.array(PredictionPromotionGateModelSchema).max(16),
  })
  .strict();

export type PredictionPromotionGateModel = z.infer<typeof PredictionPromotionGateModelSchema>;
export type PredictionPromotionGateReport = z.infer<typeof PredictionPromotionGateReportSchema>;
