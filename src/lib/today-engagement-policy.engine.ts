import {
  TODAY_ENGAGEMENT_LOW_COMPLETION_THRESHOLD,
  TODAY_ENGAGEMENT_MAX_PROBABILITY,
  TODAY_ENGAGEMENT_MIN_PROBABILITY,
  TODAY_ENGAGEMENT_POLICY_ID,
  TODAY_ENGAGEMENT_POLICY_VERSION,
  TodayEngagementPolicyShadowSchema,
  type TodayEngagementPolicyShadow,
} from "./today-engagement-policy.schema";

export type TodayEngagementPolicyShadowInput = {
  decisionId: string;
  decisionOn: string;
  decisionAction: "train_as_planned" | "train_adapted";
  modelArtifactId: string;
  sourcePredictionId: string;
  athleteStateSnapshotId: string;
  generatedAt: string;
  horizonEndsAt: string;
  baselineProbability: number;
  qualifiedProbability: number;
  personalModelQualified: boolean;
};

export function evaluateTodayEngagementPolicyShadow(
  input: TodayEngagementPolicyShadowInput,
): TodayEngagementPolicyShadow | null {
  if (!input.personalModelQualified) return null;

  const baselineProbability = boundedProbability(input.baselineProbability);
  const qualifiedProbability = boundedProbability(input.qualifiedProbability);
  const candidatePreferred = qualifiedProbability < TODAY_ENGAGEMENT_LOW_COMPLETION_THRESHOLD;

  return TodayEngagementPolicyShadowSchema.parse({
    policyId: TODAY_ENGAGEMENT_POLICY_ID,
    policyVersion: TODAY_ENGAGEMENT_POLICY_VERSION,
    decisionId: input.decisionId,
    decisionOn: input.decisionOn,
    decisionAction: input.decisionAction,
    modelArtifactId: input.modelArtifactId,
    sourcePredictionId: input.sourcePredictionId,
    athleteStateSnapshotId: input.athleteStateSnapshotId,
    generatedAt: input.generatedAt,
    horizonEndsAt: input.horizonEndsAt,
    mode: "shadow",
    exposureState: "shadow_unexposed",
    decisionAuthority: false,
    safetyEnvelope: "presentation_only_no_training_load_change",
    baselineStrategy: "standard_train_cta",
    candidateStrategy: candidatePreferred ? "choose_start_time_first" : "standard_train_cta",
    comparison: candidatePreferred ? "counterfactual_unobserved" : "equivalent_shadow",
    baselineProbability,
    qualifiedProbability,
    reason: candidatePreferred
      ? "Qualified personal completion probability is below the bounded start-support threshold."
      : "Qualified personal completion probability does not justify a presentation-only change.",
  });
}

function boundedProbability(value: number): number {
  if (!Number.isFinite(value)) throw new Error("ENGAGEMENT_POLICY_PROBABILITY_INVALID");
  return Math.min(
    TODAY_ENGAGEMENT_MAX_PROBABILITY,
    Math.max(TODAY_ENGAGEMENT_MIN_PROBABILITY, value),
  );
}
