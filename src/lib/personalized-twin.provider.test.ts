import { describe, expect, it } from "vitest";
import { personalizedTwinProviderCapability } from "./personalized-twin.provider";

describe("Personalized Twin provider capability", () => {
  it("fails closed until a reviewed reconstruction provider is wired", () => {
    expect(personalizedTwinProviderCapability()).toEqual({
      available: false,
      providerKey: null,
      supportsThreeView: true,
      outputFormat: "glb",
      medicalScan: false,
    });
  });
});
