import { z } from "zod";
import { IsoDaySchema } from "./local-day";

const StampSchema = z.string().datetime({ offset: true });
const ProbabilitySchema = z.number().finite().min(0.001).max(0.999);

export const TODAY_ENGAGEMENT_POLICY_ID = "today-training-engagement" as const;
export const TODAY_ENGAGEMENT_POLICY_VERSION = "0.1.0" as const;
export const TODAY_ENGAGEMENT_POLICY_SUPPORT_THRESHOLD = 0.45;

export const TodayEngagementPolicyStrategySchema = z.enum([
  "standard_train_cta",
  "choose_start_time_first",
]);

export const TodayEngagementPolicyComparisonSchema = z.enum([
  "equivalent_shadow",
  "counterfactual_unobserved",
]);

export const TodayEngagementPolicyShadowProposalSchema = z
  .object({
    policyId: z.literal(TODAY_ENGAGEMENT_POLICY_ID),
    policyVersion: z.literal(TODAY_ENGAGEMENT_POLICY_VERSION),
    decisionId: z.string().uuid(),
    decisionOn: IsoDaySchema,
    modelArtifactId: z.string().uuid(),
    sourcePredictionId: z.string().uuid(),
    decisionAction: z.enum(["train_as_planned", "train_adapted"]),
    athleteStateSnapshotId: z.string().uuid(),
    generatedAt: StampSchema,
    horizonEndsAt: StampSchema,
    baselineProbability: ProbabilitySchema,
    qualifiedProbability: ProbabilitySchema,
    baselineStrategy: z.literal("standard_train_cta"),
    candidateStrategy: TodayEngagementPolicyStrategySchema,
    comparison: TodayEngagementPolicyComparisonSchema,
    safetyEnvelope: z.literal("presentation_only_no_training_load_change"),
    exposureState: z.literal("shadow_unexposed"),
    decisionAuthority: z.literal(false),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Date.parse(value.horizonEndsAt) <= Date.parse(value.generatedAt)) {
      ctx.addIssue({ code: "custom", message: "Policy horizon must follow generation" });
    }
    const expected =
      value.candidateStrategy === value.baselineStrategy
        ? "equivalent_shadow"
        : "counterfactual_unobserved";
    if (value.comparison !== expected) {
      ctx.addIssue({ code: "custom", message: "Policy comparison does not match strategy" });
    }
  });

export const TodayEngagementPolicyOutcomeReviewSchema = z
  .object({
    checked: z.number().int().min(0).max(64),
    evaluated: z.number().int().min(0).max(64),
    pending: z.number().int().min(0).max(64),
    limited: z.boolean(),
  })
  .strict()
  .refine(
    (value) => value.evaluated + value.pending === value.checked,
    "Policy shadow review counts are inconsistent",
  );

export const TodayEngagementPolicyCanaryReadinessSchema = z
  .object({
    randomizedExposures: z.literal(0),
    causalEvidence: z.literal(false),
    promotionEligible: z.literal(false),
    state: z.literal("shadow_counterfactual_only"),
  })
  .strict();

export const TodayEngagementPolicyCanaryReviewSchema = z
  .object({
    outcomeReview: TodayEngagementPolicyOutcomeReviewSchema,
    readiness: TodayEngagementPolicyCanaryReadinessSchema,
  })
  .strict();

export type TodayEngagementPolicyShadowProposal = z.infer<
  typeof TodayEngagementPolicyShadowProposalSchema
>;
export type TodayEngagementPolicyOutcomeReview = z.infer<
  typeof TodayEngagementPolicyOutcomeReviewSchema
>;
export type TodayEngagementPolicyCanaryReview = z.infer<
  typeof TodayEngagementPolicyCanaryReviewSchema
>;