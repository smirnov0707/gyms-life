import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { event } from "../../../../../tests/billing/fixtures";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), verify: vi.fn(), authorize: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/paddle.server", () => ({ verifyWebhook: mocks.verify }));
vi.mock("@/lib/paddle-config.server", () => ({ authorizeWebhookPrice: mocks.authorize }));
async function post(url = "https://example.invalid/api/public/payments/webhook?env=sandbox") {
  const { Route } = await import("./webhook");
  const handlers = (
    Route as unknown as {
      options: {
        server: { handlers: { POST: ({ request }: { request: Request }) => Promise<Response> } };
      };
    }
  ).options.server.handlers;
  return handlers.POST({
    request: new Request(url, { method: "POST", body: "synthetic signed input" }),
  });
}
describe("Paddle signed event transaction boundary", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("SUPABASE_URL", "https://synthetic.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-test-only");
    mocks.verify.mockResolvedValue(event());
    mocks.authorize.mockImplementation(() => {});
    mocks.rpc.mockResolvedValue({ data: "applied", error: null });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });
  it("writes state and receipt with one RPC before acknowledging", async () => {
    const response = await post();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, outcome: "applied" });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc.mock.calls[0]![0]).toBe("apply_verified_paddle_subscription");
    expect(mocks.rpc.mock.calls[0]![1]).toMatchObject({
      p_environment: "sandbox",
      p_event_type: "subscription.created",
      p_occurred_at: "2026-09-09T09:00:00Z",
    });
  });
  it.each(["duplicate", "stale"])(
    "acknowledges database-confirmed %s without another write protocol",
    async (outcome) => {
      mocks.rpc.mockResolvedValue({ data: outcome, error: null });
      expect((await post()).status).toBe(200);
      expect(mocks.rpc).toHaveBeenCalledTimes(1);
    },
  );
  it("returns retryable failure when the transaction fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "private connection detail" } });
    const response = await post();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private");
    expect(console.error).toHaveBeenCalledWith("PADDLE_WEBHOOK_PERSISTENCE_FAILED");
  });
  it("does not manufacture success for an empty or unfamiliar transaction result", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    expect((await post()).status).toBe(503);
  });
  it("does not access persistence for invalid signatures", async () => {
    mocks.verify.mockRejectedValue(new Error("signature invalid"));
    expect((await post()).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects malformed recognized events rather than permanently claiming them", async () => {
    mocks.verify.mockResolvedValue({ ...event(), data: {} });
    expect((await post()).status).toBe(422);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not grant access for another product in the Paddle account", async () => {
    mocks.authorize.mockImplementation(() => {
      throw new Error("unknown price");
    });
    expect((await post()).status).toBe(422);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("validates the requested environment before reading the signed body", async () => {
    expect(
      (await post("https://example.invalid/api/public/payments/webhook?env=evil")).status,
    ).toBe(400);
    expect(mocks.verify).not.toHaveBeenCalled();
  });
  it("can ignore a signed unrelated notification without a false subscription receipt", async () => {
    mocks.verify.mockResolvedValue({ ...event(), eventType: "transaction.created" });
    expect(await (await post()).json()).toEqual({ received: true, ignored: true });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("a rejected transaction can be retried and committed", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: null, error: { message: "transient" } })
      .mockResolvedValueOnce({ data: "applied", error: null });
    expect((await post()).status).toBe(503);
    expect((await post()).status).toBe(200);
  });
});
