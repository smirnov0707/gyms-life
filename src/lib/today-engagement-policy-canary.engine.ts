import {
  PolicyShadowOutcomeReviewSchema,
  TodayEngagementPolicyCanaryReviewSchema,
  type PolicyShadowOutcomeReview,
  type TodayEngagementPolicyCanaryReview,
} from "./today-engagement-policy-canary.schema";
import {
  TodayEngagementPolicyEvidenceSchema,
  type TodayEngagementPolicyEvidence,
} from "./today-engagement-policy-evidence.schema";
import {
  TodayEngagementProtocolReadinessSchema,
  type TodayEngagementProtocolReadiness,
} from "./today-engagement-policy-protocol.schema";

export function buildTodayEngagementPolicyCanaryReview(
  rawOutcomeReview: PolicyShadowOutcomeReview,
  rawEvidence: TodayEngagementPolicyEvidence,
  rawProtocol: TodayEngagementProtocolReadiness,
): TodayEngagementPolicyCanaryReview {
  const outcomeReview = PolicyShadowOutcomeReviewSchema.parse(rawOutcomeReview);
  const evidence = TodayEngagementPolicyEvidenceSchema.parse(rawEvidence);
  const protocol = TodayEngagementProtocolReadinessSchema.parse(rawProtocol);

  return TodayEngagementPolicyCanaryReviewSchema.parse({
    outcomeReview,
    evidence,
    protocol,
    readiness: {
      randomizedExposures: 0,
      causalEvidence: false,
      promotionEligible: false,
    },
  });
}
