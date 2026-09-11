import { describe, expect, it } from "vitest";
import { derivePersonalizedTwinUiPhase } from "./personalized-twin.presentation";
import type { PersonalizedTwinProviderCapability } from "./personalized-twin.provider";

const approved: PersonalizedTwinProviderCapability = {
  available: true,
  providerKey: "reviewed",
  candidate: null,
  captureModes: ["three_view"],
  outputFormat: "glb" as const,
  externalProcessing: true,
  privacyReview: "approved" as const,
  medicalScan: false as const,
};

describe("Personalized Twin presentation state", () => {
  it("keeps incomplete or unconsented capture in collecting", () => {
    expect(
      derivePersonalizedTwinUiPhase({
        localComplete: false,
        consentGranted: true,
        capability: null,
      }),
    ).toBe("collecting");
    expect(
      derivePersonalizedTwinUiPhase({
        localComplete: true,
        consentGranted: false,
        capability: approved,
      }),
    ).toBe("collecting");
  });
  it("separates local readiness from provider approval", () => {
    expect(
      derivePersonalizedTwinUiPhase({
        localComplete: true,
        consentGranted: true,
        capability: null,
      }),
    ).toBe("provider_blocked");
    expect(
      derivePersonalizedTwinUiPhase({
        localComplete: true,
        consentGranted: true,
        capability: approved,
      }),
    ).toBe("local_ready");
  });
  it("server lifecycle is authoritative for processing and terminal states", () => {
    expect(
      derivePersonalizedTwinUiPhase({
        localComplete: false,
        consentGranted: false,
        capability: null,
        lifecycleStatus: "processing",
      }),
    ).toBe("processing");
    expect(
      derivePersonalizedTwinUiPhase({
        localComplete: false,
        consentGranted: false,
        capability: null,
        lifecycleStatus: "ready",
      }),
    ).toBe("ready");
    expect(
      derivePersonalizedTwinUiPhase({
        localComplete: true,
        consentGranted: true,
        capability: approved,
        lifecycleStatus: "failed",
      }),
    ).toBe("failed");
  });
});
