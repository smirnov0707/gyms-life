import { z } from "zod";
import { IsoDaySchema } from "./local-day";

export const TODAY_ENGAGEMENT_POLICY_ID = "today-training-engagement" as const;
export const TODAY_ENGAGEMENT_POLICY_VERSION = "0.1.0" as const;
export const TODAY_ENGAGEMENT_LOW_COMPLETION_THRESHOLD = 0.45;
export const TODAY_ENGAGEMENT_MIN_PROBABILITY = 0.001;
export const TODAY_ENGAGEMENT_MAX_PROBABILITY = 0.999;

export const TodayEngagementStrategySchema = z.enum([
  "standard_train_cta",
  "choose_start_time_first",
]);
export type TodayEngagementStrategy = z.infer<typeof TodayEngagementStrategySchema>;

export const TodayEngagementPolicyComparisonSchema = z.enum([
  "equivalent_shadow",
  "counterfactual_unobserved",
]);

export const TodayEngagementDecisionActionSchema = z.enum([
  "train_as_planned",
  "train_adapted",
]);

export const TodayEngagementPolicyShadowSchema = z
  .object({
    policyId: z.literal(TODAY_ENGAGEMENT_POLICY_ID),
    policyVersion: z.literal(TODAY_ENGAGEMENT_POLICY_VERSION),
    decisionId: z.string().uuid(),
    decisionOn: IsoDaySchema,
    decisionAction: TodayEngagementDecisionActionSchema,
    modelArtifactId: z.string().uuid(),
    sourcePredictionId: z.string().uuid(),
    athleteStateSnapshotId: z.string().uuid(),
    generatedAt: z.string().datetime({ offset: true }),
    horizonEndsAt: z.string().datetime({ offset: true }),
    mode: z.literal("shadow"),
    exposureState: z.literal("shadow_unexposed"),
    decisionAuthority: z.literal(false),
    safetyEnvelope: z.literal("presentation_only_no_training_load_change"),
    baselineStrategy: z.literal("standard_train_cta"),
    candidateStrategy: TodayEngagementStrategySchema,
    comparison: TodayEngagementPolicyComparisonSchema,
    baselineProbability: z
      .number()
      .finite()
      .min(TODAY_ENGAGEMENT_MIN_PROBABILITY)
      .max(TODAY_ENGAGEMENT_MAX_PROBABILITY),
    qualifiedProbability: z
      .number()
      .finite()
      .min(TODAY_ENGAGEMENT_MIN_PROBABILITY)
      .max(TODAY_ENGAGEMENT_MAX_PROBABILITY),
    reason: z.string().trim().min(1),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Date.parse(value.horizonEndsAt) <= Date.parse(value.generatedAt))
      ctx.addIssue({
        code: "custom",
        message: "Policy horizon must end after generation",
        path: ["horizonEndsAt"],
      });
    const expectedComparison =
      value.candidateStrategy === "standard_train_cta"
        ? "equivalent_shadow"
        : "counterfactual_unobserved";
    if (value.comparison !== expectedComparison)
      ctx.addIssue({
        code: "custom",
        message: "Policy comparison must match the shadow candidate",
        path: ["comparison"],
      });
  });

export type TodayEngagementPolicyShadow = z.infer<typeof TodayEngagementPolicyShadowSchema>;
