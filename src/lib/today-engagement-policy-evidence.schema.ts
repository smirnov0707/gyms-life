import { z } from "zod";

export const PolicyEvidenceArmSchema = z
  .object({
    reviewedDays: z.number().int().min(0),
    completedDays: z.number().int().min(0),
    completionRate: z.number().finite().min(0).max(1).nullable(),
  })
  .strict()
  .refine((v) => v.completedDays <= v.reviewedDays, "Invalid policy evidence counts");

export const TodayEngagementPolicyEvidenceSchema = z
  .object({
    equivalent: PolicyEvidenceArmSchema,
    counterfactual: PolicyEvidenceArmSchema,
    observationalDelta: z.number().finite().min(-1).max(1).nullable(),
    causalEvidence: z.literal(false),
    promotionEligible: z.literal(false),
  })
  .strict();

export type TodayEngagementPolicyEvidence = z.infer<typeof TodayEngagementPolicyEvidenceSchema>;
