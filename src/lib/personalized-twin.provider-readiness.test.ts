import { describe, expect, it } from "vitest";
import {
  assertSignedInputTtl,
  readPersonalizedTwinProviderSecrets,
} from "./personalized-twin.provider-readiness";
import { parsePersonalizedTwinProviderResponse } from "./personalized-twin.provider-response";

describe("Personalized Twin provider readiness", () => {
  it("requires a fully verified secret contract", () => {
    expect(
      readPersonalizedTwinProviderSecrets({ THREEDLOOK_API_BASE_URL: "https://api.example" }),
    ).toBeNull();
  });

  it("limits signed input URLs to five minutes", () => {
    const now = new Date("2026-09-11T13:00:00Z");
    expect(() => assertSignedInputTtl("2026-09-11T13:05:00Z", now)).not.toThrow();
    expect(() => assertSignedInputTtl("2026-09-11T13:05:01Z", now)).toThrow(
      "PERSONALIZED_TWIN_INPUT_URL_TTL_TOO_LONG",
    );
  });

  it("parses provider status without trusting unknown fields", () => {
    expect(parsePersonalizedTwinProviderResponse({ status: "processing", ignored: true })).toEqual({
      status: "processing",
    });
    expect(() =>
      parsePersonalizedTwinProviderResponse({ status: "ready", modelUrl: "not-a-url" }),
    ).toThrow();
  });
});
