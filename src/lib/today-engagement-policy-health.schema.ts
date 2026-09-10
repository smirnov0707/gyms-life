import { z } from "zod";

export const TODAY_ENGAGEMENT_DRIFT_WINDOW_DAYS = 14;
export const TODAY_ENGAGEMENT_DRIFT_MIN_DAYS = 10;
export const TODAY_ENGAGEMENT_DRIFT_ATTENTION_THRESHOLD = 0.2;

const OutcomeWindowSchema = z
  .object({
    reviewedDays: z.number().int().min(0).max(TODAY_ENGAGEMENT_DRIFT_WINDOW_DAYS),
    completionRate: z.number().finite().min(0).max(1).nullable(),
  })
  .strict();

export const TodayEngagementPolicyHealthSchema = z
  .object({
    state: z.enum(["insufficient_evidence", "stable_observation", "drift_attention"]),
    recent: OutcomeWindowSchema,
    prior: OutcomeWindowSchema,
    absoluteCompletionRateDrift: z.number().finite().min(0).max(1).nullable(),
    canonicalFallback: z.literal("standard_train_cta"),
    rollbackPrepared: z.literal(true),
    activationAllowed: z.literal(false),
    causalEvidence: z.literal(false),
    promotionEligible: z.literal(false),
  })
  .strict();

export type TodayEngagementPolicyHealth = z.infer<typeof TodayEngagementPolicyHealthSchema>;
