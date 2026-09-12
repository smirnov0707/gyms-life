import { describe, expect, it } from "vitest";
import { buildPersonalizedTwinCaptureFlow } from "./personalized-twin.capture-flow";
import { personalizedTwinProviderCapability } from "./personalized-twin.provider";

describe("Personalized Twin capture flow", () => {
  it("keeps the three-view UI local when the candidate requires guided video", () => {
    expect(buildPersonalizedTwinCaptureFlow(personalizedTwinProviderCapability())).toEqual({
      localPrototypeMode: "three_view",
      providerCaptureMode: "guided_video",
      currentUiCanSubmit: false,
      requiresDifferentCapture: true,
      externalProcessing: true,
      privacyReviewApproved: false,
    });
  });

  it("requires both a compatible capture mode and approved privacy review", () => {
    expect(
      buildPersonalizedTwinCaptureFlow({
        available: true,
        providerKey: "reviewed-provider",
        candidate: null,
        captureModes: ["three_view"],
        outputFormat: "glb",
        externalProcessing: true,
        privacyReview: "approved",
        medicalScan: false,
      }).currentUiCanSubmit,
    ).toBe(true);
  });
});
