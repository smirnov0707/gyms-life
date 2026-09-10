import type { AthletePrediction } from "./prediction.schema";
import { personalCompletionProbability } from "./personal-completion-model.engine";
import type { PersonalCompletionArtifact } from "./personal-completion-model.schema";
import {
  TODAY_ENGAGEMENT_POLICY_ID,
  TODAY_ENGAGEMENT_POLICY_SUPPORT_THRESHOLD,
  TODAY_ENGAGEMENT_POLICY_VERSION,
  TodayEngagementPolicyCanaryReviewSchema,
  TodayEngagementPolicyShadowProposalSchema,
  type TodayEngagementPolicyCanaryReview,
  type TodayEngagementPolicyOutcomeReview,
  type TodayEngagementPolicyShadowProposal,
} from "./today-engagement-policy.schema";

function boundedProbability(value: number): number {
  return Math.min(0.999, Math.max(0.001, value));
}

/**
 * Derives what a presentation-only engagement policy would have done after a
 * personal completion model has passed its frozen forward holdout.
 *
 * This is intentionally not a treatment assignment: it cannot change Today,
 * training load, recovery, plan generation, or the CTA the athlete receives.
 */
export function buildTodayEngagementPolicyShadow(input: {
  artifact: PersonalCompletionArtifact;
  decisionId: string;
  decisionOn: string;
  decisionAction: "train_as_planned" | "train_adapted";
  athleteStateSnapshotId: string;
  baseline: AthletePrediction;
}): TodayEngagementPolicyShadowProposal | null {
  const { artifact, baseline } = input;
  if (artifact.status !== "qualified") return null;
  if (input.decisionOn <= artifact.trainedThrough) return null;
  if (
    baseline.target !== "workout_completion" ||
    baseline.modelId !== artifact.sourceModelId ||
    baseline.modelVersion !== artifact.sourceModelVersion ||
    baseline.maturity !== "shadow" ||
    baseline.predicted.kind !== "probability" ||
    baseline.actual !== null ||
    baseline.evaluatedAt !== null ||
    baseline.athleteStateSnapshotId !== input.athleteStateSnapshotId
  ) {
    return null;
  }

  const baselineProbability = boundedProbability(baseline.predicted.value);
  const qualifiedProbability = personalCompletionProbability(artifact, baselineProbability);
  const candidateStrategy =
    qualifiedProbability < TODAY_ENGAGEMENT_POLICY_SUPPORT_THRESHOLD
      ? "choose_start_time_first"
      : "standard_train_cta";

  return TodayEngagementPolicyShadowProposalSchema.parse({
    policyId: TODAY_ENGAGEMENT_POLICY_ID,
    policyVersion: TODAY_ENGAGEMENT_POLICY_VERSION,
    decisionId: input.decisionId,
    decisionOn: input.decisionOn,
    modelArtifactId: artifact.id,
    sourcePredictionId: baseline.id,
    decisionAction: input.decisionAction,
    athleteStateSnapshotId: input.athleteStateSnapshotId,
    generatedAt: baseline.generatedAt,
    horizonEndsAt: baseline.horizonEndsAt,
    baselineProbability,
    qualifiedProbability,
    baselineStrategy: "standard_train_cta",
    candidateStrategy,
    comparison:
      candidateStrategy === "standard_train_cta"
        ? "equivalent_shadow"
        : "counterfactual_unobserved",
    safetyEnvelope: "presentation_only_no_training_load_change",
    exposureState: "shadow_unexposed",
    decisionAuthority: false,
  });
}

/**
 * A shadow counterfactual is not causal evidence. Until a separately reviewed
 * randomized exposure protocol exists, promotion must remain impossible.
 */
export function buildTodayEngagementPolicyCanaryReview(
  outcomeReview: TodayEngagementPolicyOutcomeReview,
): TodayEngagementPolicyCanaryReview {
  return TodayEngagementPolicyCanaryReviewSchema.parse({
    outcomeReview,
    readiness: {
      randomizedExposures: 0,
      causalEvidence: false,
      promotionEligible: false,
      state: "shadow_counterfactual_only",
    },
  });
}