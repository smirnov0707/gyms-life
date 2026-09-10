import { z } from "zod";

export const TodayEngagementStrategySchema = z.enum([
  "standard_train_cta",
  "choose_start_time_first",
]);
export type TodayEngagementStrategy = z.infer<typeof TodayEngagementStrategySchema>;

export const TodayEngagementPolicyComparisonSchema = z.enum([
  "baseline_retained",
  "candidate_preferred",
]);

export const TodayEngagementPolicyShadowSchema = z.object({
  policyId: z.literal("today-engagement-start-support"),
  policyVersion: z.literal("0.1.0"),
  mode: z.literal("shadow"),
  exposureState: z.literal("shadow_unexposed"),
  decisionAuthority: z.literal(false),
  safetyEnvelope: z.literal("presentation_only_no_training_load_change"),
  baselineStrategy: TodayEngagementStrategySchema,
  candidateStrategy: TodayEngagementStrategySchema,
  comparison: TodayEngagementPolicyComparisonSchema,
  baselineProbability: z.number().min(0).max(1),
  qualifiedProbability: z.number().min(0).max(1),
  reason: z.string().min(1),
});
export type TodayEngagementPolicyShadow = z.infer<typeof TodayEngagementPolicyShadowSchema>;

export const TODAY_ENGAGEMENT_LOW_COMPLETION_THRESHOLD = 0.45;
