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
  TodayEngagementPolicyHealthSchema,
  type TodayEngagementPolicyHealth,
} from "./today-engagement-policy-health.schema";
import {
  TodayEngagementProtocolReadinessSchema,
  type TodayEngagementProtocolReadiness,
} from "./today-engagement-policy-protocol.schema";

export function buildTodayEngagementPolicyCanaryReview(
  rawOutcomeReview: PolicyShadowOutcomeReview,
  rawEvidence: TodayEngagementPolicyEvidence,
  rawHealth: TodayEngagementPolicyHealth,
  rawProtocol: TodayEngagementProtocolReadiness,
): TodayEngagementPolicyCanaryReview {
  const outcomeReview = PolicyShadowOutcomeReviewSchema.parse(rawOutcomeReview);
  const evidence = TodayEngagementPolicyEvidenceSchema.parse(rawEvidence);
  const health = TodayEngagementPolicyHealthSchema.parse(rawHealth);
  const protocol = TodayEngagementProtocolReadinessSchema.parse(rawProtocol);

  return TodayEngagementPolicyCanaryReviewSchema.parse({
    outcomeReview,
    evidence,
    health,
    protocol,
    readiness: {
      randomizedExposures: 0,
      causalEvidence: false,
      promotionEligible: false,
    },
  });
}
