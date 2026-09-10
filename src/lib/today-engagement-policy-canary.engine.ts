import {
  PolicyShadowOutcomeReviewSchema,
  TodayEngagementPolicyCanaryReviewSchema,
  type PolicyShadowOutcomeReview,
  type TodayEngagementPolicyCanaryReview,
} from "./today-engagement-policy-canary.schema";

/**
 * Shadow evidence can be reviewed, but this guard intentionally cannot
 * authorize exposure. A future prospective experiment needs a separate,
 * explicit protocol and rollout decision.
 */
export function buildTodayEngagementPolicyCanaryReview(
  rawOutcomeReview: PolicyShadowOutcomeReview,
): TodayEngagementPolicyCanaryReview {
  const outcomeReview = PolicyShadowOutcomeReviewSchema.parse(rawOutcomeReview);

  return TodayEngagementPolicyCanaryReviewSchema.parse({
    outcomeReview,
    readiness: {
      randomizedExposures: 0,
      causalEvidence: false,
      promotionEligible: false,
    },
  });
}
