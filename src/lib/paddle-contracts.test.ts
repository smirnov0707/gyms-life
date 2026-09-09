import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { normalizePaddleSubscriptionEvent } from "./paddle-event.schema";
import { authorizeWebhookPrice, paymentEnvironment } from "./paddle-config.server";
import { resolveApplicationPrice } from "./paddle-prices.server";
import { mirrorCancellation, readPaymentSubscription } from "./payment-subscription.service";
import { event, id, price, USER } from "../../tests/billing/fixtures";
afterEach(() => vi.unstubAllEnvs());
describe("verified subscription snapshots", () => {
  it("native IDs work without import_meta", () => {
    const source = event();
    const { importMeta: _import, ...native } = source.data.items[0]!.price;
    const result = normalizePaddleSubscriptionEvent({
      ...source,
      data: { ...source.data, items: [{ ...source.data.items[0], price: native }] },
    });
    expect(result?.subscription).toMatchObject({
      price_id: id("pri"),
      product_id: id("pro"),
      user_id: USER,
    });
    expect(result?.importedPriceKey).toBeNull();
  });
  it.each([
    "subscription.updated",
    "subscription.activated",
    "subscription.paused",
    "subscription.resumed",
    "subscription.past_due",
    "subscription.trialing",
    "subscription.canceled",
  ])("processes lifecycle snapshot %s", (type) =>
    expect(normalizePaddleSubscriptionEvent(event(type))?.eventType).toBe(type),
  );
  it("allows missing custom user data only for persistence to resolve an existing owner", () => {
    const source = event();
    expect(
      normalizePaddleSubscriptionEvent({ ...source, data: { ...source.data, customData: null } })
        ?.subscription.user_id,
    ).toBeNull();
  });
  it("rejects multi-item ambiguity rather than choosing any cheap recurring product", () => {
    const source = event();
    expect(() =>
      normalizePaddleSubscriptionEvent({
        ...source,
        data: { ...source.data, items: [...source.data.items, ...source.data.items] },
      }),
    ).toThrow(/ITEMS/);
  });
  it("rejects an invalid owner marker without guessing ownership", () => {
    const source = event();
    expect(() =>
      normalizePaddleSubscriptionEvent({
        ...source,
        data: { ...source.data, customData: { userId: "not-uuid" } },
      }),
    ).toThrow();
  });
  it("rejects backwards billing periods", () => {
    const source = event();
    expect(() =>
      normalizePaddleSubscriptionEvent({
        ...source,
        data: {
          ...source.data,
          currentBillingPeriod: {
            startsAt: "2026-10-01T00:00:00Z",
            endsAt: "2026-09-01T00:00:00Z",
          },
        },
      }),
    ).toThrow(/PERIOD/);
  });
});
describe("application payment environment and whitelist", () => {
  it("disabled billing cannot trigger management calls", () => {
    vi.stubEnv("VITE_BILLING_ENABLED", "false");
    expect(paymentEnvironment).toThrow("BILLING_DISABLED");
  });
  it("missing or contradictory tokens cannot silently select live", () => {
    vi.stubEnv("VITE_BILLING_ENABLED", "true");
    vi.stubEnv("VITE_PAYMENTS_CLIENT_TOKEN", "");
    vi.stubEnv("PADDLE_ENVIRONMENT", "");
    expect(paymentEnvironment).toThrow();
    vi.stubEnv("VITE_PAYMENTS_CLIENT_TOKEN", "test_synthetic");
    vi.stubEnv("PADDLE_ENVIRONMENT", "live");
    expect(paymentEnvironment).toThrow(/MISMATCH/);
  });
  it("derives sandbox from the configured token when explicit env is blank", () => {
    vi.stubEnv("VITE_BILLING_ENABLED", "true");
    vi.stubEnv("VITE_PAYMENTS_CLIENT_TOKEN", "test_synthetic");
    vi.stubEnv("PADDLE_ENVIRONMENT", "");
    expect(paymentEnvironment()).toBe("sandbox");
  });
  it("accepts an explicitly mapped native price, not arbitrary products", () => {
    vi.stubEnv("PADDLE_PRICE_MAP", JSON.stringify({ sandbox: { vex_monthly: id("pri") } }));
    expect(() => authorizeWebhookPrice("sandbox", id("pri"), null)).not.toThrow();
    expect(() => authorizeWebhookPrice("live", id("pri"), null)).toThrow();
    expect(() => authorizeWebhookPrice("sandbox", id("pri", 2), "other-product")).toThrow();
    expect(() => authorizeWebhookPrice("sandbox", id("pri", 2), "vex_monthly")).toThrow();
  });
});
describe("price resolution matches the displayed plan", () => {
  const page = (items: unknown[], next: string | null = null) =>
    Response.json({ data: items, meta: { pagination: { has_more: !!next, next } } });
  it("does not return the first arbitrary item from an unfiltered price list", async () => {
    const fetch = vi.fn().mockResolvedValue(page([price(9, "other-product"), price()]));
    expect(
      await resolveApplicationPrice("vex_monthly", "sandbox", { fetch, mapping: undefined }),
    ).toBe(id("pri"));
    expect(fetch.mock.calls[0]![1]).not.toContain("external_id=");
  });
  it("traverses the second page when necessary", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        page([price(9, "other")], "https://sandbox-api.paddle.com/prices?after=" + id("pri", 9)),
      )
      .mockResolvedValueOnce(page([price()]));
    expect(
      await resolveApplicationPrice("vex_monthly", "sandbox", { fetch, mapping: undefined }),
    ).toBe(id("pri"));
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("rejects duplicate imported matches", async () => {
    const fetch = vi.fn().mockResolvedValue(page([price(), price(2)]));
    await expect(
      resolveApplicationPrice("vex_monthly", "sandbox", { fetch, mapping: undefined }),
    ).rejects.toThrow(/NOT_UNIQUE/);
  });
  it("never follows provider pagination to a different origin", async () => {
    const fetch = vi.fn().mockResolvedValue(page([], "https://other.invalid/prices"));
    await expect(
      resolveApplicationPrice("vex_monthly", "sandbox", { fetch, mapping: undefined }),
    ).rejects.toThrow(/ORIGIN/);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("resolves a configured native ID directly", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ data: price() }));
    expect(
      await resolveApplicationPrice("vex_monthly", "sandbox", {
        fetch,
        mapping: JSON.stringify({ sandbox: { vex_monthly: id("pri") } }),
      }),
    ).toBe(id("pri"));
    expect(fetch).toHaveBeenCalledWith("sandbox", "/prices/" + id("pri"));
  });
  it.each([
    { unit_price: { amount: "1", currency_code: "EUR" } },
    { unit_price: { amount: "1200", currency_code: "USD" } },
    { billing_cycle: null },
    { billing_cycle: { interval: "year", frequency: 1 } },
    { billing_cycle: { interval: "month", frequency: 12 } },
    { status: "archived" },
  ])("rejects mismatched cost/cycle/status %j", async (changed) => {
    const fetch = vi.fn().mockResolvedValue(page([{ ...price(), ...changed }]));
    await expect(
      resolveApplicationPrice("vex_monthly", "sandbox", { fetch, mapping: undefined }),
    ).rejects.toThrow(/MISMATCH/);
  });
  it("rejects arbitrary input before a provider request", async () => {
    const fetch = vi.fn();
    await expect(
      resolveApplicationPrice("attacker-price", "sandbox", { fetch, mapping: undefined }),
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
});
describe("owned subscription management", () => {
  const row = {
    id: USER,
    paddle_customer_id: id("ctm"),
    paddle_subscription_id: id("sub"),
    environment: "sandbox" as const,
    status: "active",
    cancel_at_period_end: false,
    updated_at: "2026-09-09T00:00:00Z",
  };
  function mock(data: unknown, error: unknown = null) {
    const calls: unknown[] = [];
    const result = Promise.resolve({ data, error });
    const chain = new Proxy(
      {},
      {
        get: (_t, key) =>
          key === "then"
            ? result.then.bind(result)
            : (...args: unknown[]) => {
                calls.push([key, ...args]);
                return chain;
              },
      },
    );
    return { client: { from: () => chain } as unknown as SupabaseClient<Database>, calls };
  }
  it("scopes reads to both the owner and server environment", async () => {
    const db = mock(row);
    expect((await readPaymentSubscription(db.client, USER, "sandbox")).id).toBe(USER);
    expect(db.calls).toContainEqual(["eq", "environment", "sandbox"]);
    expect(db.calls).toContainEqual(["eq", "user_id", USER]);
  });
  it("does not report a successful local mirror for zero updated rows", async () => {
    const db = mock(null);
    expect(await mirrorCancellation(db.client, USER, row, true)).toBe(false);
    expect(db.calls).toContainEqual(["eq", "updated_at", row.updated_at]);
  });
  it("a confirmed mirror row is synchronized", async () => {
    const db = mock({ id: USER });
    expect(await mirrorCancellation(db.client, USER, row, true)).toBe(true);
  });
  it("cannot choose a newer row from another billing environment", async () => {
    const db = mock({ ...row, environment: "live" });
    await expect(readPaymentSubscription(db.client, USER, "sandbox")).rejects.toThrow(/MISMATCH/);
  });
});
