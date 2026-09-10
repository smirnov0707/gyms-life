import {
  TODAY_ENGAGEMENT_LOW_COMPLETION_THRESHOLD,
  TodayEngagementPolicyShadowSchema,
  type TodayEngagementPolicyShadow,
} from "./today-engagement-policy.schema";

export function evaluateTodayEngagementPolicyShadow(input: {
  baselineProbability: number;
  qualifiedProbability: number;
  personalModelQualified: boolean;
}): TodayEngagementPolicyShadow {
  const baselineProbability = clampProbability(input.baselineProbability);
  const qualifiedProbability = clampProbability(input.qualifiedProbability);

  const candidatePreferred =
    input.personalModelQualified &&
    qualifiedProbability < TODAY_ENGAGEMENT_LOW_COMPLETION_THRESHOLD;

  return TodayEngagementPolicyShadowSchema.parse({
    policyId: "today-engagement-start-support",
    policyVersion: "0.1.0",
    mode: "shadow",
    exposureState: "shadow_unexposed",
    decisionAuthority: false,
    safetyEnvelope: "presentation_only_no_training_load_change",
    baselineStrategy: "standard_train_cta",
    candidateStrategy: candidatePreferred ? "choose_start_time_first" : "standard_train_cta",
    comparison: candidatePreferred ? "candidate_preferred" : "baseline_retained",
    baselineProbability,
    qualifiedProbability,
    reason: candidatePreferred
      ? "Qualified personal completion probability is below the bounded start-support threshold."
      : input.personalModelQualified
        ? "Qualified personal completion probability does not justify a presentation-only change."
        : "Personal completion model is not qualified for policy evaluation.",
  });
}

function clampProbability(value: number): number {
  if (!Number.isFinite(value)) throw new Error("ENGAGEMENT_POLICY_PROBABILITY_INVALID");
  return Math.min(1, Math.max(0, value));
}
