import { z } from "zod";
import type { DigitalTwinState } from "./digital-athlete.schema";

export const SafetyGuardianReasonSchema = z.enum(["active_safety_constraint"]);

export const SafetyGuardianAssessmentSchema = z
  .object({
    status: z.enum(["clear", "manual_review_required"]),
    allowsAutomaticAdjustment: z.boolean(),
    reasons: z.array(SafetyGuardianReasonSchema).max(8),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === "manual_review_required" && value.allowsAutomaticAdjustment) {
      context.addIssue({
        code: "custom",
        path: ["allowsAutomaticAdjustment"],
        message: "Automatic adjustment cannot be allowed while manual safety review is required.",
      });
    }
    if (value.status === "clear" && value.reasons.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["reasons"],
        message: "A clear safety assessment cannot contain blocking reasons.",
      });
    }
  });

export type SafetyGuardianAssessment = z.infer<typeof SafetyGuardianAssessmentSchema>;

/**
 * Deterministic safety boundary for coaching autonomy.
 *
 * This does not diagnose, prescribe treatment, or decide the workout. It only
 * determines whether automated coaching changes may proceed. An explicit
 * safety constraint always overrides AI/model suggestions.
 */
export function evaluateSafetyGuardian(state: DigitalTwinState): SafetyGuardianAssessment {
  if (state.currentContext.hasSafetyConstraint) {
    return SafetyGuardianAssessmentSchema.parse({
      status: "manual_review_required",
      allowsAutomaticAdjustment: false,
      reasons: ["active_safety_constraint"],
    });
  }

  return SafetyGuardianAssessmentSchema.parse({
    status: "clear",
    allowsAutomaticAdjustment: true,
    reasons: [],
  });
}
