import { describe, expect, it } from "vitest";
import { buildPersonalizedTwinPreflight } from "./personalized-twin.preflight";
import { INITIAL_TWIN_ROTATION_PROGRESS } from "./personalized-twin.rotation-progress";
import { personalizedTwinProviderCapability } from "./personalized-twin.provider";

const readyFraming = { status: "ready", automatic: true, bodyHeightRatio: 0.7 } as const;
const readyQuality = { status: "ready", canAdvanceRotation: true } as const;
const completeRotation = {
  ...INITIAL_TWIN_ROTATION_PROGRESS,
  phase: 5 as const,
  progressPct: 100,
  completeEstimate: true,
};

describe("Personalized Twin scan preflight", () => {
  it("requires every local capture gate in order", () => {
    expect(
      buildPersonalizedTwinPreflight({
        cameraActive: false,
        framing: readyFraming,
        quality: readyQuality,
        rotation: completeRotation,
        capability: null,
      }).status,
    ).toBe("camera_missing");
    expect(
      buildPersonalizedTwinPreflight({
        cameraActive: true,
        framing: { status: "cropped", automatic: true, bodyHeightRatio: 0.9 },
        quality: readyQuality,
        rotation: completeRotation,
        capability: null,
      }).status,
    ).toBe("framing_not_ready");
    expect(
      buildPersonalizedTwinPreflight({
        cameraActive: true,
        framing: readyFraming,
        quality: { status: "stabilizing", canAdvanceRotation: false },
        rotation: completeRotation,
        capability: null,
      }).status,
    ).toBe("quality_not_ready");
    expect(
      buildPersonalizedTwinPreflight({
        cameraActive: true,
        framing: readyFraming,
        quality: readyQuality,
        rotation: INITIAL_TWIN_ROTATION_PROGRESS,
        capability: null,
      }).status,
    ).toBe("rotation_incomplete");
  });

  it("marks local completion but blocks an unapproved provider", () => {
    const result = buildPersonalizedTwinPreflight({
      cameraActive: true,
      framing: readyFraming,
      quality: readyQuality,
      rotation: completeRotation,
      capability: personalizedTwinProviderCapability(),
    });
    expect(result).toEqual({
      status: "provider_blocked",
      localComplete: true,
      canSubmitToProvider: false,
    });
  });

  it("allows provider submission only after explicit approval", () => {
    const result = buildPersonalizedTwinPreflight({
      cameraActive: true,
      framing: readyFraming,
      quality: readyQuality,
      rotation: completeRotation,
      capability: {
        ...personalizedTwinProviderCapability(),
        available: true,
        providerKey: "reviewed",
        privacyReview: "approved",
      },
    });
    expect(result).toEqual({
      status: "ready_for_provider",
      localComplete: true,
      canSubmitToProvider: true,
    });
  });
});
