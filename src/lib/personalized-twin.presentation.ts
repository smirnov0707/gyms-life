import type { PersonalizedTwinLifecycleStatus } from "./personalized-twin.lifecycle";
import type { PersonalizedTwinProviderCapability } from "./personalized-twin.provider";

export type PersonalizedTwinUiPhase =
  "collecting" | "local_ready" | "provider_blocked" | "processing" | "ready" | "failed";

export function derivePersonalizedTwinUiPhase(input: {
  localComplete: boolean;
  consentGranted: boolean;
  capability: PersonalizedTwinProviderCapability | null;
  lifecycleStatus?: PersonalizedTwinLifecycleStatus | null;
}): PersonalizedTwinUiPhase {
  if (input.lifecycleStatus === "processing") return "processing";
  if (input.lifecycleStatus === "ready") return "ready";
  if (input.lifecycleStatus === "failed") return "failed";
  if (!input.localComplete || !input.consentGranted) return "collecting";
  const providerReady =
    input.capability?.available === true && input.capability.privacyReview === "approved";
  return providerReady ? "local_ready" : "provider_blocked";
}
