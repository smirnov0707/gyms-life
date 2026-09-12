import {
  TODAY_ENGAGEMENT_DRIFT_ATTENTION_THRESHOLD,
  TODAY_ENGAGEMENT_DRIFT_MIN_DAYS,
  TODAY_ENGAGEMENT_DRIFT_WINDOW_DAYS,
  TodayEngagementPolicyHealthSchema,
  type TodayEngagementPolicyHealth,
} from "./today-engagement-policy-health.schema";

function summarize(values: boolean[]) {
  const window = values.slice(0, TODAY_ENGAGEMENT_DRIFT_WINDOW_DAYS);
  return {
    reviewedDays: window.length,
    completionRate: window.length ? window.filter(Boolean).length / window.length : null,
  };
}

export function evaluateTodayEngagementPolicyHealth(input: {
  recentOutcomes: boolean[];
  priorOutcomes: boolean[];
}): TodayEngagementPolicyHealth {
  const recent = summarize(input.recentOutcomes);
  const prior = summarize(input.priorOutcomes);
  const enough =
    recent.reviewedDays >= TODAY_ENGAGEMENT_DRIFT_MIN_DAYS &&
    prior.reviewedDays >= TODAY_ENGAGEMENT_DRIFT_MIN_DAYS;
  const drift =
    enough && recent.completionRate !== null && prior.completionRate !== null
      ? Math.abs(recent.completionRate - prior.completionRate)
      : null;
  return TodayEngagementPolicyHealthSchema.parse({
    state: !enough
      ? "insufficient_evidence"
      : drift! >= TODAY_ENGAGEMENT_DRIFT_ATTENTION_THRESHOLD
        ? "drift_attention"
        : "stable_observation",
    recent,
    prior,
    absoluteCompletionRateDrift: drift,
    canonicalFallback: "standard_train_cta",
    rollbackPrepared: true,
    activationAllowed: false,
    causalEvidence: false,
    promotionEligible: false,
  });
}
