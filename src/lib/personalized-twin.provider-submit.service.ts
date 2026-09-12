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
  claimSubmission(input: {
    userId: string;
    captureSetId: string;
    providerKey: string;
    claimToken: string;
    claimUntil: string;
  }): Promise<"claimed" | "busy" | { providerJobId: string }>;
  releaseSubmissionClaim(input: {
    userId: string;
    captureSetId: string;
    claimToken: string;
  }): Promise<void>;
  markProcessing(input: {
    userId: string;
    captureSetId: string;
    providerKey: string;
    providerJobId: string;
    claimToken: string;
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
  claimToken?: string;
  now?: () => Date;
}): Promise<{ providerJobId: string; reused: boolean }> {
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

  const now = (input.now ?? (() => new Date()))();
  const claimToken = input.claimToken ?? crypto.randomUUID();
  const claim = await input.persistence.claimSubmission({
    userId: input.userId,
    captureSetId: input.captureSetId,
    providerKey: input.provider.key,
    claimToken,
    claimUntil: new Date(now.getTime() + 60_000).toISOString(),
  });
  if (claim === "busy") throw new Error("PERSONALIZED_TWIN_PROVIDER_SUBMISSION_BUSY");
  if (claim !== "claimed") return { providerJobId: claim.providerJobId, reused: true };

  try {
    const result = await input.provider.submit({
      captureReference: input.captureSetId,
      inputs: input.providerInputs,
    });
    await input.persistence.markProcessing({
      userId: input.userId,
      captureSetId: input.captureSetId,
      providerKey: input.provider.key,
      providerJobId: result.providerJobId,
      claimToken,
    });
    return { providerJobId: result.providerJobId, reused: false };
  } catch (error) {
    await input.persistence
      .releaseSubmissionClaim({
        userId: input.userId,
        captureSetId: input.captureSetId,
        claimToken,
      })
      .catch(() => undefined);
    throw error;
  }
}
