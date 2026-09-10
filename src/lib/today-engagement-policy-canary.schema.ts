import { z } from "zod";

export const PolicyShadowOutcomeReviewSchema = z
  .object({
    checked: z.number().int().min(0).max(64),
    evaluated: z.number().int().min(0).max(64),
    limited: z.boolean(),
  })
  .strict()
  .refine((value) => value.evaluated <= value.checked, "Invalid policy outcome review counts");

export type PolicyShadowOutcomeReview = z.infer<typeof PolicyShadowOutcomeReviewSchema>;

export const PolicyCanaryReadinessSchema = z
  .object({
    randomizedExposures: z.literal(0),
    causalEvidence: z.literal(false),
    promotionEligible: z.literal(false),
  })
  .strict();

export const TodayEngagementPolicyCanaryReviewSchema = z
  .object({
    outcomeReview: PolicyShadowOutcomeReviewSchema,
    readiness: PolicyCanaryReadinessSchema,
  })
  .strict();

export type TodayEngagementPolicyCanaryReview = z.infer<
  typeof TodayEngagementPolicyCanaryReviewSchema
>;
