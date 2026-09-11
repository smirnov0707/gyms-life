import { describe, expect, it } from "vitest";
import { personalizedTwinProviderCapability } from "./personalized-twin.provider";

describe("Personalized Twin provider capability", () => {
  it("fails closed while naming the reviewed integration candidate and its real capture mode", () => {
    expect(personalizedTwinProviderCapability()).toEqual({
      available: false,
      providerKey: null,
      candidate: "in3d",
      captureModes: ["guided_video"],
      outputFormat: "glb",
      externalProcessing: true,
      privacyReview: "requires_contract",
      medicalScan: false,
    });
  });
});
