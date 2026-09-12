import { describe, expect, it } from "vitest";
import { buildGuidedTwinScanState } from "./personalized-twin.guided-scan";
import { personalizedTwinProviderCapability } from "./personalized-twin.provider";

describe("guided Personalized Twin scan", () => {
  it("keeps an in3D candidate capture local while privacy approval is missing", () => {
    const state = buildGuidedTwinScanState({
      started: true,
      capturing: false,
      captured: true,
      progressPct: 100,
      cameraPermission: "granted",
      capability: personalizedTwinProviderCapability(),
    });
    expect(state.status).toBe("captured_local");
    expect(state.canSubmitToProvider).toBe(false);
  });

  it("only becomes provider-submittable with guided-video support and approved privacy", () => {
    const state = buildGuidedTwinScanState({
      started: true,
      capturing: false,
      captured: true,
      progressPct: 100,
      cameraPermission: "granted",
      capability: {
        ...personalizedTwinProviderCapability(),
        available: true,
        providerKey: "reviewed-provider",
        privacyReview: "approved",
      },
    });
    expect(state.status).toBe("awaiting_provider");
    expect(state.canSubmitToProvider).toBe(true);
  });
});
