import { z } from "zod";

export const TODAY_ENGAGEMENT_PROTOCOL_VERSION = "0.1.0" as const;
export const TODAY_ENGAGEMENT_MIN_REVIEWED_DAYS = 40;
export const TODAY_ENGAGEMENT_MIN_COUNTERFACTUAL_DAYS = 10;

export const TodayEngagementProtocolBlockerSchema = z.enum([
  "personal_model_not_qualified",
  "insufficient_reviewed_shadow_days",
  "insufficient_counterfactual_days",
  "outcome_backlog_not_clear",
]);

export const TodayEngagementProtocolReadinessSchema = z
  .object({
    protocolVersion: z.literal(TODAY_ENGAGEMENT_PROTOCOL_VERSION),
    state: z.enum(["blocked", "ready_for_manual_protocol_review"]),
    reviewedShadowDays: z.number().int().min(0),
    counterfactualDays: z.number().int().min(0),
    blockers: z.array(TodayEngagementProtocolBlockerSchema),
    randomizationConfigured: z.literal(false),
    activationAllowed: z.literal(false),
    causalEvidence: z.literal(false),
    promotionEligible: z.literal(false),
  })
  .strict();

export type TodayEngagementProtocolReadiness = z.infer<
  typeof TodayEngagementProtocolReadinessSchema
>;
