import {
  PolicyShadowOutcomeReviewSchema,
  TodayEngagementPolicyCanaryReviewSchema,
  type PolicyShadowOutcomeReview,
  type TodayEngagementPolicyCanaryReview,
} from "./today-engagement-policy-canary.schema";
import {
  TodayEngagementProtocolReadinessSchema,
  type TodayEngagementProtocolReadiness,
} from "./today-engagement-policy-protocol.schema";

/**
 * Shadow evidence can be reviewed, but this guard intentionally cannot
 * authorize exposure. A future prospective experiment needs a separate,
 * explicit rollout decision.
 */
export function buildTodayEngagementPolicyCanaryReview(
  rawOutcomeReview: PolicyShadowOutcomeReview,
  rawProtocol: TodayEngagementProtocolReadiness,
): TodayEngagementPolicyCanaryReview {
  const outcomeReview = PolicyShadowOutcomeReviewSchema.parse(rawOutcomeReview);
  const protocol = TodayEngagementProtocolReadinessSchema.parse(rawProtocol);

  return TodayEngagementPolicyCanaryReviewSchema.parse({
    outcomeReview,
    protocol,
    readiness: {
      randomizedExposures: 0,
      causalEvidence: false,
      promotionEligible: false,
    },
  });
}
