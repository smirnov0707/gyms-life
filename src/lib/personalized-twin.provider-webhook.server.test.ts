import { describe, expect, it, vi } from "vitest";
import { parseVerifiedPersonalizedTwinWebhook } from "./personalized-twin.provider-webhook.server";

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

describe("Personalized Twin provider webhook", () => {
  it("rejects before parsing when signature is invalid", () => {
    const verify = vi.fn().mockReturnValue(false);
    expect(() =>
      parseVerifiedPersonalizedTwinWebhook({
        rawBody: encode({ invalid: "payload" }),
        signature: "bad",
        verify,
      }),
    ).toThrow("PERSONALIZED_TWIN_WEBHOOK_SIGNATURE_INVALID");
    expect(verify).toHaveBeenCalledTimes(1);
  });

  it("parses only a verified terminal/provider status envelope", () => {
    expect(
      parseVerifiedPersonalizedTwinWebhook({
        rawBody: encode({
          eventId: "evt-1",
          providerJobId: "job-1",
          payload: { status: "failed", errorCode: "vendor_failure" },
        }),
        signature: "valid",
        verify: () => true,
      }),
    ).toEqual({
      eventId: "evt-1",
      providerJobId: "job-1",
      result: { status: "failed", errorCode: "vendor_failure" },
    });
  });
});
