import {
  TODAY_ENGAGEMENT_MIN_COUNTERFACTUAL_DAYS,
  TODAY_ENGAGEMENT_MIN_REVIEWED_DAYS,
  TODAY_ENGAGEMENT_PROTOCOL_VERSION,
  TodayEngagementProtocolReadinessSchema,
  type TodayEngagementProtocolReadiness,
} from "./today-engagement-policy-protocol.schema";

export function evaluateTodayEngagementProtocolReadiness(input: {
  personalModelQualified: boolean;
  reviewedShadowDays: number;
  counterfactualDays: number;
  outcomeBacklogClear: boolean;
}): TodayEngagementProtocolReadiness {
  const blockers: TodayEngagementProtocolReadiness["blockers"] = [];
  if (!input.personalModelQualified) blockers.push("personal_model_not_qualified");
  if (input.reviewedShadowDays < TODAY_ENGAGEMENT_MIN_REVIEWED_DAYS)
    blockers.push("insufficient_reviewed_shadow_days");
  if (input.counterfactualDays < TODAY_ENGAGEMENT_MIN_COUNTERFACTUAL_DAYS)
    blockers.push("insufficient_counterfactual_days");
  if (!input.outcomeBacklogClear) blockers.push("outcome_backlog_not_clear");

  return TodayEngagementProtocolReadinessSchema.parse({
    protocolVersion: TODAY_ENGAGEMENT_PROTOCOL_VERSION,
    state: blockers.length ? "blocked" : "ready_for_manual_protocol_review",
    reviewedShadowDays: input.reviewedShadowDays,
    counterfactualDays: input.counterfactualDays,
    blockers,
    randomizationConfigured: false,
    activationAllowed: false,
    causalEvidence: false,
    promotionEligible: false,
  });
}
