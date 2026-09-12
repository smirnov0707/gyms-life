import { z } from "zod";

export const PersonalizedTwinDataPolicySchema = z.object({
  inputPhotoRetention: z.literal("delete_after_processing"),
  generatedModelRetention: z.literal("until_user_deletes"),
  providerTrainingUseAllowed: z.literal(false),
  externalProcessingConsentRequired: z.literal(true),
  userDeletionRequired: z.literal(true),
  medicalScan: z.literal(false),
});

export type PersonalizedTwinDataPolicy = z.infer<typeof PersonalizedTwinDataPolicySchema>;

export const PERSONALIZED_TWIN_DATA_POLICY: PersonalizedTwinDataPolicy =
  PersonalizedTwinDataPolicySchema.parse({
    inputPhotoRetention: "delete_after_processing",
    generatedModelRetention: "until_user_deletes",
    providerTrainingUseAllowed: false,
    externalProcessingConsentRequired: true,
    userDeletionRequired: true,
    medicalScan: false,
  });

export type PersonalizedTwinProviderPrivacyEvidence = {
  noTrainingOnUserMedia: boolean;
  deletesInputAfterProcessing: boolean;
  supportsUserDeletion: boolean;
  contractReviewed: boolean;
};

export function providerMeetsPersonalizedTwinPolicy(
  evidence: PersonalizedTwinProviderPrivacyEvidence,
): boolean {
  return (
    evidence.noTrainingOnUserMedia &&
    evidence.deletesInputAfterProcessing &&
    evidence.supportsUserDeletion &&
    evidence.contractReviewed
  );
}
