import { z } from "zod";
import type { PersonalizedTwinProviderCapability } from "./personalized-twin.provider";

export const PersonalizedTwinProviderActivationReviewSchema = z.object({
  dpaApproved: z.boolean(),
  retentionApproved: z.boolean(),
  trainingUseProhibited: z.boolean(),
  userDeletionSupported: z.boolean(),
  transferRiskApproved: z.boolean(),
  captureConsentVersion: z.literal("personalized_twin_v1"),
});

export type PersonalizedTwinProviderActivationReview = z.infer<
  typeof PersonalizedTwinProviderActivationReviewSchema
>;

export type PersonalizedTwinProviderActivationDecision = {
  allowed: boolean;
  blockers: readonly string[];
};

export function evaluatePersonalizedTwinProviderActivation(input: {
  capability: PersonalizedTwinProviderCapability;
  review: PersonalizedTwinProviderActivationReview;
}): PersonalizedTwinProviderActivationDecision {
  const blockers: string[] = [];
  if (!input.capability.available) blockers.push("capability_unavailable");
  if (input.capability.privacyReview !== "approved") blockers.push("privacy_review_not_approved");
  if (!input.capability.externalProcessing) blockers.push("external_processing_contract_mismatch");
  if (!input.review.dpaApproved) blockers.push("dpa_not_approved");
  if (!input.review.retentionApproved) blockers.push("retention_not_approved");
  if (!input.review.trainingUseProhibited) blockers.push("provider_training_not_prohibited");
  if (!input.review.userDeletionSupported) blockers.push("user_deletion_not_supported");
  if (!input.review.transferRiskApproved) blockers.push("transfer_risk_not_approved");
  return { allowed: blockers.length === 0, blockers };
}

export function assertPersonalizedTwinProviderActivation(input: {
  capability: PersonalizedTwinProviderCapability;
  review: PersonalizedTwinProviderActivationReview;
}): void {
  const decision = evaluatePersonalizedTwinProviderActivation(input);
  if (!decision.allowed)
    throw new Error(`PERSONALIZED_TWIN_PROVIDER_BLOCKED:${decision.blockers.join(",")}`);
}
