import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyWebhook } from "./paddle.server";
import { normalizePaddleSubscriptionEvent } from "./paddle-event.schema";
import { id, USER } from "../../tests/billing/fixtures";
const secret = "synthetic-signature-test-secret-not-a-provider-key";
const raw = () =>
  JSON.stringify({
    event_id: id("evt"),
    event_type: "subscription.created",
    occurred_at: "2026-09-09T09:00:00Z",
    data: {
      id: id("sub"),
      customer_id: id("ctm"),
      status: "active",
      billing_cycle: { interval: "month", frequency: 1 },
      current_billing_period: {
        starts_at: "2026-09-01T00:00:00Z",
        ends_at: "2026-10-01T00:00:00Z",
      },
      scheduled_change: null,
      custom_data: { userId: USER },
      items: [
        {
          recurring: true,
          quantity: 1,
          price: {
            id: id("pri"),
            product_id: id("pro"),
            unit_price: { amount: "1200", currency_code: "EUR" },
            billing_cycle: { interval: "month", frequency: 1 },
            import_meta: null,
          },
          product: { id: id("pro"), name: "Synthetic product" },
        },
      ],
    },
  });
function request(body: string, stamp = Math.floor(Date.now() / 1000), signedBody = body) {
  const digest = createHmac("sha256", secret).update(`${stamp}:${signedBody}`).digest("hex");
  return new Request("https://example.invalid/api/public/payments/webhook?env=sandbox", {
    method: "POST",
    body,
    headers: { "paddle-signature": `ts=${stamp};h1=${digest}` },
  });
}
beforeEach(() => {
  vi.stubEnv("PADDLE_SANDBOX_API_KEY", "synthetic-sdk-no-network");
  vi.stubEnv("PAYMENTS_SANDBOX_WEBHOOK_SECRET", secret);
});
afterEach(() => vi.unstubAllEnvs());
describe("actual Paddle SDK signature verification", () => {
  it("accepts a correctly signed original byte payload and normalizes native IDs", async () => {
    const result = await verifyWebhook(request(raw()), "sandbox");
    expect(normalizePaddleSubscriptionEvent(result)?.subscription).toMatchObject({
      id: id("sub"),
      user_id: USER,
      price_id: id("pri"),
      product_id: id("pro"),
    });
  });
  it("rejects body tampering after the signature was made", async () => {
    const original = raw();
    await expect(
      verifyWebhook(request(original + " ", undefined, original), "sandbox"),
    ).rejects.toThrow();
  });
  it("rejects an expired replay signature", async () => {
    await expect(
      verifyWebhook(request(raw(), Math.floor(Date.now() / 1000) - 3600), "sandbox"),
    ).rejects.toThrow();
  });
  it("rejects a missing signature", async () => {
    await expect(
      verifyWebhook(
        new Request("https://example.invalid", { method: "POST", body: raw() }),
        "sandbox",
      ),
    ).rejects.toThrow();
  });
  it("bounds streaming request bytes before JSON/SDK parsing", async () => {
    await expect(verifyWebhook(request("x".repeat(1_048_577)), "sandbox")).rejects.toThrow(
      "PADDLE_BODY_LIMIT",
    );
  });
});
