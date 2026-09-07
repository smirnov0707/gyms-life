import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The payments webhook, where a dropped error is a lost subscription.
 *
 * Paddle stops retrying an event it was told arrived, so `{received: true}`
 * is a promise that the row was written. Two of these cases pin failures
 * that used to answer with exactly that promise and write nothing: a
 * Supabase error the handler never looked at, and the idempotency row —
 * taken before the work — that made every later retry look like a duplicate.
 */

type Answer = { error?: { code?: string; message?: string } | null };

/** Each `table.op` answers in call order; anything unscripted succeeds. */
let script: Record<string, Answer[]>;
let calls: string[];

function thenable(key: string) {
  const settle = () => {
    calls.push(key);
    const next = script[key]?.shift();
    return Promise.resolve({ data: null, error: next?.error ?? null });
  };
  const chain: Record<string, unknown> = {
    eq: () => chain,
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      settle().then(resolve, reject),
  };
  return chain;
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => ({
      insert: () => thenable(`${table}.insert`),
      upsert: () => thenable(`${table}.upsert`),
      update: () => thenable(`${table}.update`),
      delete: () => thenable(`${table}.delete`),
    }),
  }),
}));

let nextEvent: unknown;
vi.mock("@/lib/paddle.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/paddle.server")>();
  return { ...actual, verifyWebhook: async () => nextEvent };
});

const USER = "11111111-2222-4333-8444-555555555555";

function subscriptionCreated(eventId = "evt_1") {
  return {
    eventId,
    eventType: "subscription.created",
    data: {
      id: "sub_1",
      customerId: "ctm_1",
      status: "active",
      currentBillingPeriod: { startsAt: "2026-09-01T00:00:00Z", endsAt: "2026-10-01T00:00:00Z" },
      customData: { userId: USER },
      items: [
        {
          price: { id: "pri_1", importMeta: { externalId: "price-external" } },
          product: { id: "pro_1", importMeta: { externalId: "product-external" } },
        },
      ],
    },
  };
}

async function post(url = "https://gyms.life/api/public/payments/webhook?env=live") {
  const { Route } = await import("./webhook");
  const handlers = (
    Route as unknown as {
      options: {
        server: { handlers: { POST: (input: { request: Request }) => Promise<Response> } };
      };
    }
  ).options.server.handlers;
  const response = await handlers.POST({
    request: new Request(url, { method: "POST", body: "{}" }),
  });
  return { status: response.status, text: await response.text() };
}

describe("Paddle webhook", () => {
  beforeEach(() => {
    vi.resetModules();
    script = {};
    calls = [];
    process.env["SUPABASE_URL"] = "https://example.supabase.co";
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "service-role-key-for-tests";
    nextEvent = subscriptionCreated();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("claims the event, writes the subscription and acknowledges", async () => {
    const { status, text } = await post();
    expect(status).toBe(200);
    expect(text).toContain("received");
    expect(calls).toEqual(["paddle_webhook_events.insert", "subscriptions.upsert"]);
  });

  it("skips an event it has already processed", async () => {
    script = { "paddle_webhook_events.insert": [{ error: { code: "23505" } }] };
    const { status } = await post();
    expect(status).toBe(200);
    // Claimed by an earlier delivery: nothing is written a second time.
    expect(calls).toEqual(["paddle_webhook_events.insert"]);
  });

  it("does not acknowledge a subscription write that failed", async () => {
    // Paddle only retries what it was not told arrived, so a 200 here would
    // have ended this subscription's chances permanently.
    script = { "subscriptions.upsert": [{ error: { code: "42501", message: "denied" } }] };
    const { status } = await post();
    expect(status).toBe(400);
  });

  it("gives the event back when the write failed, so the retry can work", async () => {
    script = { "subscriptions.upsert": [{ error: { code: "42501", message: "denied" } }] };
    await post();
    expect(calls).toEqual([
      "paddle_webhook_events.insert",
      "subscriptions.upsert",
      // Without this delete the claim doubled as a receipt and every retry
      // was skipped as a duplicate.
      "paddle_webhook_events.delete",
    ]);
  });

  it("keeps the claim when the work succeeded", async () => {
    await post();
    expect(calls).not.toContain("paddle_webhook_events.delete");
  });

  it("returns the original failure even when the release also fails", async () => {
    script = {
      "subscriptions.upsert": [{ error: { code: "42501", message: "denied" } }],
      "paddle_webhook_events.delete": [{ error: { code: "42501", message: "denied too" } }],
    };
    const { status } = await post();
    expect(status).toBe(400);
  });

  it("refuses an environment it does not recognise", async () => {
    const { status } = await post("https://gyms.life/api/public/payments/webhook?env=staging");
    expect(status).toBe(400);
    expect(calls).toEqual([]);
  });

  it("does not write a subscription for an event with no user id", async () => {
    const event = subscriptionCreated();
    event.data.customData = { userId: "not-a-uuid" };
    nextEvent = event;
    const { status } = await post();
    // Claimed and acknowledged: this event is not ours and retrying will not
    // make it ours, but nothing is written under a guessed account.
    expect(status).toBe(200);
    expect(calls).toEqual(["paddle_webhook_events.insert"]);
  });
});
