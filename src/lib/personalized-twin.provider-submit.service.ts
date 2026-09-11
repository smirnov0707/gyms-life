import {
  assertPersonalizedTwinProviderActivation,
  type PersonalizedTwinProviderActivationReview,
} from "./personalized-twin.provider-activation";
import type {
  PersonalizedTwinProviderCapability,
  PersonalizedTwinProviderInput,
  PersonalizedTwinReconstructionProvider,
} from "./personalized-twin.provider";

export interface PersonalizedTwinProviderSubmissionPersistence {
  markProcessing(input: {
    userId: string;
    captureSetId: string;
    providerKey: string;
    providerJobId: string;
  }): Promise<void>;
}

export async function submitPersonalizedTwinToProvider(input: {
  userId: string;
  captureSetId: string;
  capability: PersonalizedTwinProviderCapability;
  review: PersonalizedTwinProviderActivationReview;
  provider: PersonalizedTwinReconstructionProvider;
  providerInputs: readonly PersonalizedTwinProviderInput[];
  persistence: PersonalizedTwinProviderSubmissionPersistence;
}): Promise<{ providerJobId: string }> {
  assertPersonalizedTwinProviderActivation({ capability: input.capability, review: input.review });
  if (input.capability.providerKey !== input.provider.key)
    throw new Error("PERSONALIZED_TWIN_PROVIDER_KEY_MISMATCH");
  const requiredAngles = ["front", "side", "back"] as const;
  const suppliedAngles = new Set(input.providerInputs.map((item) => item.angle));
  if (
    input.providerInputs.length !== requiredAngles.length ||
    requiredAngles.some((angle) => !suppliedAngles.has(angle))
  )
    throw new Error("PERSONALIZED_TWIN_PROVIDER_INPUTS_REQUIRED");

  const result = await input.provider.submit({
    captureReference: input.captureSetId,
    inputs: input.providerInputs,
  });
  await input.persistence.markProcessing({
    userId: input.userId,
    captureSetId: input.captureSetId,
    providerKey: input.provider.key,
    providerJobId: result.providerJobId,
  });
  return result;
}
