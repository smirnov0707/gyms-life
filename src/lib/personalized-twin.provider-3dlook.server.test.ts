import { describe, expect, it } from "vitest";
import { ThreeDLookPersonalizedTwinProvider } from "./personalized-twin.provider-3dlook.server";

const inputs = [
  { angle: "front" as const, url: "https://signed/front", expiresAt: "2026-09-11T17:00:00Z" },
  { angle: "side" as const, url: "https://signed/side", expiresAt: "2026-09-11T17:00:00Z" },
  { angle: "back" as const, url: "https://signed/back", expiresAt: "2026-09-11T17:00:00Z" },
];

describe("3DLOOK Personalized Twin provider skeleton", () => {
  it("fails closed with no credentials", async () => {
    const provider = new ThreeDLookPersonalizedTwinProvider(null);
    await expect(provider.submit({ captureReference: "capture-1", inputs })).rejects.toThrow(
      "PERSONALIZED_TWIN_3DLOOK_NOT_CONFIGURED",
    );
  });

  it("still refuses external submission when credentials exist but adapter review is incomplete", async () => {
    const provider = new ThreeDLookPersonalizedTwinProvider({
      apiBaseUrl: "https://example.invalid",
      apiToken: "test-only",
    });
    await expect(provider.submit({ captureReference: "capture-1", inputs })).rejects.toThrow(
      "PERSONALIZED_TWIN_3DLOOK_ADAPTER_REVIEW_REQUIRED",
    );
  });
});
