import { describe, expect, it, vi } from "vitest";
import { runProductionSmoke } from "./production-smoke.checks.mjs";

const dispatch = "/api/internal/night-lab";
const schedule = "/.netlify/functions/night-lab";
const html = "<!doctype html><html><title>GYMS.LIFE</title></html>";
function fixture(overrides = {}) {
  return vi.fn(async (url) => {
    const path = url.pathname;
    if (Object.hasOwn(overrides, path)) return overrides[path]();
    if (path === dispatch) return new Response("Unauthorized", { status: 401 });
    if (path === schedule) return new Response(null, { status: 403 });
    return new Response(html, { headers: { "content-type": "text/html" } });
  });
}
function run(transport) {
  return runProductionSmoke({ base: "https://synthetic.invalid", transport });
}

describe("production smoke fails closed", () => {
  it("passes configured public guards without claiming completed Night Lab work", async () => {
    const report = await run(fixture());
    expect(report.ok).toBe(true);
    expect(report.executionVerified).toBe(false);
    expect(report.results).toHaveLength(9);
  });

  it("detects missing cron configuration even while every page and schedule guard pass", async () => {
    const report = await run(
      fixture({
        [dispatch]: () => new Response("Server configuration error", { status: 500 }),
      }),
    );
    expect(report.ok).toBe(false);
    expect(report.results.filter((result) => !result.ok)).toEqual([
      {
        name: "night-lab-dispatch-auth-guard",
        ok: false,
        status: 500,
        reason: "night_lab_configuration_or_runtime_unavailable",
      },
    ]);
  });

  it.each([200, 202, 302, 403, 404, 503])(
    "rejects dispatch HTTP %s instead of auth confirmation",
    async (status) => {
      const report = await run(
        fixture({ [dispatch]: () => new Response("Unexpected", { status }) }),
      );
      expect(report.ok).toBe(false);
      expect(report.results.at(-1)).toMatchObject({ status, ok: false });
    },
  );

  it("does not treat an HTML login/error response as an application auth guard", async () => {
    const report = await run(
      fixture({
        [dispatch]: () =>
          new Response(html, { status: 401, headers: { "content-type": "text/html" } }),
      }),
    );
    expect(report.ok).toBe(false);
  });

  it("never supplies credentials, follows dispatch redirects, or directly calls the worker", async () => {
    const transport = fixture();
    await run(transport);
    for (const [url, init] of transport.mock.calls) {
      expect(url.pathname).not.toContain("worker-background");
      expect(new Headers(init.headers).has("authorization")).toBe(false);
      expect(new Headers(init.headers).has("cookie")).toBe(false);
      expect(init.credentials).toBe("omit");
    }
    const call = transport.mock.calls.find(([url]) => url.pathname === dispatch);
    expect(call?.[1]).toMatchObject({ method: "POST", body: "{}", redirect: "manual" });
    expect(transport.mock.calls.filter(([, init]) => init.method === "POST")).toHaveLength(1);
  });

  it("rejects an environment safety error rendered with HTTP 200", async () => {
    const report = await run(
      fixture({
        "/": () =>
          new Response(html + "Environment safety check", {
            headers: { "content-type": "text/html" },
          }),
      }),
    );
    expect(report.results[0]).toMatchObject({ ok: false, reason: "environment_safety_block" });
  });

  it("requires real HTML rather than branded JSON", async () => {
    const report = await run(fixture({ "/": () => Response.json({ error: html }) }));
    expect(report.results[0].ok).toBe(false);
  });

  it("classifies hosting quota failures without logging arbitrary remote data", async () => {
    const report = await run(
      fixture({
        "/": () =>
          Response.json({ error: "usage_exceeded", message: "PRIVATE_SENTINEL" }, { status: 503 }),
        [dispatch]: () => new Response("PRIVATE_SENTINEL", { status: 500 }),
      }),
    );
    expect(report.results[0]).toMatchObject({ ok: false, reason: "hosting_usage_exceeded" });
    expect(JSON.stringify(report)).not.toContain("PRIVATE_SENTINEL");
  });

  it("continues checking after a transport exception without echoing its payload", async () => {
    const transport = fixture({
      "/": () => {
        throw new Error("PRIVATE_SENTINEL");
      },
    });
    const report = await run(transport);
    expect(report.ok).toBe(false);
    expect(transport).toHaveBeenCalledTimes(9);
    expect(report.results[0].reason).toBe("request_failed_or_timed_out");
    expect(JSON.stringify(report)).not.toContain("PRIVATE_SENTINEL");
  });

  it.each([0, -1, NaN, 1.5, 120001])(
    "rejects invalid timeout %s before making requests",
    async (timeoutMs) => {
      const transport = fixture();
      await expect(runProductionSmoke({ transport, timeoutMs })).rejects.toThrow(
        "SMOKE_TIMEOUT_INVALID",
      );
      expect(transport).not.toHaveBeenCalled();
    },
  );

  it.each(["file:///tmp/fixture", "https://user:password@synthetic.invalid"])(
    "rejects unsafe base %s before making requests",
    async (base) => {
      const transport = fixture();
      await expect(runProductionSmoke({ transport, base })).rejects.toThrow(
        "SMOKE_BASE_URL_INVALID",
      );
      expect(transport).not.toHaveBeenCalled();
    },
  );

  it("rejects a page redirected to another origin", async () => {
    const response = new Response(html, { headers: { "content-type": "text/html" } });
    Object.defineProperty(response, "url", { value: "https://foreign.invalid/auth" });
    const report = await run(fixture({ "/": () => response }));
    expect(report.results[0].ok).toBe(false);
  });

  it("fails a check when response body reading fails after headers arrive", async () => {
    const response = new Response(html);
    response.text = async () => {
      throw new DOMException("PRIVATE_SENTINEL", "TimeoutError");
    };
    const report = await run(fixture({ [dispatch]: () => response }));
    expect(report.results.at(-1)).toMatchObject({
      ok: false,
      reason: "request_failed_or_timed_out",
    });
    expect(JSON.stringify(report)).not.toContain("PRIVATE_SENTINEL");
  });
});
