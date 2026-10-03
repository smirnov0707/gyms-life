import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const sdk = vi.hoisted(() => ({ getContext: vi.fn() }));
vi.mock("@netlify/functions", () => ({ getContext: sdk.getContext }));
import { dispatchCurrentNightLab, currentNightLabTarget } from "./night-lab.dispatch.server";
import {
  matchesNightLabDatabase,
  nightLabRuntimeTarget,
  TARGET_CONTEXT_REFUSALS,
} from "./night-lab.target";
const STAGE = "https://yywnpovsqifwujuxdxog.supabase.co",
  PROD = "https://tqwqbjkjqzusohxdzupr.supabase.co",
  ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const context = (kind = "deploy-preview", published = false) => ({
  deploy: { id: ID, context: kind, published },
  site: { name: "synthetic-site", url: "https://gyms.life" },
});
const read = (database = STAGE) =>
  vi.fn((name: string) =>
    name === "SUPABASE_URL"
      ? database
      : name === "GYMSLIFE_CRON_SECRET"
        ? "synthetic-cron-test-not-a-key"
        : undefined,
  );
beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("trusted runtime origin for scheduled and framework dispatch", () => {
  it.each(["deploy-preview", "branch-deploy"])(
    "%s uses an immutable deployment, not the main-site address",
    async (kind) => {
      const settings = read(),
        send = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
      expect(await dispatchCurrentNightLab(() => context(kind), settings, send)).toEqual({
        status: "queued",
      });
      expect(String(send.mock.calls[0]![0])).toBe(
        `https://${ID}--synthetic-site.netlify.app/.netlify/functions/night-lab-worker-background`,
      );
      expect(settings.mock.calls.map((row) => row[0])).toEqual([
        "SUPABASE_URL",
        "GYMSLIFE_CRON_SECRET",
      ]);
      expect(send.mock.calls[0]![1].redirect).toBe("error");
      expect(send.mock.calls[0]![1].signal).toBeInstanceOf(AbortSignal);
    },
  );
  it("production uses its current immutable deployment and production database", async () => {
    const send = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    expect(
      await dispatchCurrentNightLab(() => context("production", true), read(PROD), send),
    ).toEqual({ status: "queued" });
    expect(String(send.mock.calls[0]![0])).toContain(ID + "--synthetic-site");
  });
  it("actual adapter defaults obtain SDK request context and Netlify runtime settings", async () => {
    sdk.getContext.mockReturnValue(context());
    const settings = read(),
      send = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("Netlify", { env: { get: settings } });
    vi.stubGlobal("fetch", send);
    vi.stubEnv("URL", "https://gyms.life");
    vi.stubEnv("DEPLOY_URL", "https://untrusted.example");
    expect(await dispatchCurrentNightLab()).toEqual({ status: "queued" });
    expect(sdk.getContext).toHaveBeenCalledTimes(1);
    expect(String(send.mock.calls[0]![0])).not.toContain("gyms.life");
  });
  it("no active provider context cannot fall back to any environment URL or Host", async () => {
    const settings = read(),
      send = vi.fn();
    vi.stubEnv("URL", "https://gyms.life");
    expect(
      await dispatchCurrentNightLab(
        () => {
          throw new Error("outside request");
        },
        settings,
        send,
      ),
    ).toEqual({ status: "unavailable", reason: "TARGET_RESOLUTION_THREW" });
    expect(settings).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
  // One code per cause, not one name for eight cases. The first firing of the
  // schedule recorded the old collapsed `TARGET_DEPLOYMENT_UNIDENTIFIED` and
  // left nothing to act on; each row below is now a different thing to fix,
  // and the refusal still happens before any secret or transport is touched.
  it.each([
    [null, "TARGET_CONTEXT_NOT_AN_OBJECT"],
    [{}, "TARGET_CONTEXT_DEPLOY_MISSING"],
    [
      { deploy: { id: ID, context: "deploy-preview", published: false } },
      "TARGET_CONTEXT_SITE_MISSING",
    ],
    [{ site: { name: "synthetic-site" } }, "TARGET_CONTEXT_DEPLOY_MISSING"],
    [context("dev"), "TARGET_CONTEXT_NOT_A_KNOWN_CONTEXT"],
    [context("unexpected"), "TARGET_CONTEXT_NOT_A_KNOWN_CONTEXT"],
    [context("production", false), "TARGET_DEPLOYMENT_NOT_PUBLISHED"],
    [context("deploy-preview", true), "TARGET_DEPLOYMENT_NOT_PUBLISHED"],
  ])(
    "untrusted/inconsistent context %j fails before secrets or transport, naming its cause",
    async (value, reason) => {
      const settings = read(),
        send = vi.fn();
      expect(await dispatchCurrentNightLab(() => value, settings, send)).toEqual({
        status: "unavailable",
        reason,
      });
      expect(settings).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
    },
  );

  it("does not answer two different problems with the same code", () => {
    // `Record<Path, Code>` makes the compiler demand an entry per field. It
    // cannot demand that they differ, which is exactly what went wrong.
    const distinct = new Set(TARGET_CONTEXT_REFUSALS);
    expect(distinct.size).toBe(TARGET_CONTEXT_REFUSALS.length);
    for (const code of TARGET_CONTEXT_REFUSALS) expect(code).toMatch(/^[A-Z][A-Z0-9_]{2,63}$/);
  });
  it.each([
    "..",
    "bad.example",
    "user@host",
    "//gyms.life",
    "x/y",
    "x?query",
    "x#frag",
    "-name",
    "name-",
    "UPPER",
    "",
    "a".repeat(64),
  ])("rejects malformed site metadata %s", async (name) => {
    const value = { ...context(), site: { name } },
      settings = read(),
      send = vi.fn();
    expect(nightLabRuntimeTarget(value)).toBeNull();
    expect(await dispatchCurrentNightLab(() => value, settings, send)).toEqual({
      status: "unavailable",
      reason: "TARGET_CONTEXT_SITE_NAME_UNRECOGNISED",
    });
    expect(send).not.toHaveBeenCalled();
  });
  it.each(["abc", "x".repeat(24), ID + "/path", ID + ".evil.invalid", ""])(
    "rejects malformed deployment IDs %s",
    async (id) => {
      const value = context();
      value.deploy.id = id;
      const send = vi.fn();
      expect(await dispatchCurrentNightLab(() => value, read(), send)).toEqual({
        status: "unavailable",
        reason: "TARGET_CONTEXT_DEPLOY_ID_UNRECOGNISED",
      });
      expect(send).not.toHaveBeenCalled();
    },
  );
  it.each([
    ["deploy-preview", false, PROD],
    ["branch-deploy", false, PROD],
    ["production", true, STAGE],
  ] as const)(
    "%s cannot dispatch with another environment's database",
    async (kind, published, database) => {
      const settings = read(database),
        send = vi.fn();
      expect(await dispatchCurrentNightLab(() => context(kind, published), settings, send)).toEqual(
        { status: "unavailable", reason: "TARGET_DATABASE_MISMATCH" },
      );
      expect(settings.mock.calls.map((row) => row[0])).toEqual(["SUPABASE_URL"]);
      expect(send).not.toHaveBeenCalled();
    },
  );
  it.each([
    undefined,
    "",
    STAGE + "/path",
    STAGE + "?x=1",
    STAGE + "#fragment",
    " https://yywnpovsqifwujuxdxog.supabase.co",
    "https://user:pass@yywnpovsqifwujuxdxog.supabase.co",
    "http://yywnpovsqifwujuxdxog.supabase.co",
  ])("malformed database metadata %s is not a compatible runtime", (value) => {
    expect(matchesNightLabDatabase(value, STAGE)).toBe(false);
  });
  it("allows a canonical trailing slash but not a foreign hostname", () => {
    expect(matchesNightLabDatabase(STAGE + "/", STAGE)).toBe(true);
    expect(matchesNightLabDatabase(STAGE + ".example", STAGE)).toBe(false);
  });
  it("missing configuration and missing runtime env API fail closed", async () => {
    const send = vi.fn();
    expect(
      await dispatchCurrentNightLab(
        () => context(),
        () => undefined,
        send,
      ),
      // No SUPABASE_URL to compare against is a database mismatch, not a
      // missing secret: the target is refused before the secret is read.
    ).toEqual({ status: "unavailable", reason: "TARGET_DATABASE_MISMATCH" });
    vi.stubGlobal("Netlify", undefined);
    expect(await dispatchCurrentNightLab(() => context(), undefined, send)).toEqual({
      status: "unavailable",
      reason: "TARGET_RESOLUTION_THREW",
    });
    expect(send).not.toHaveBeenCalled();
  });
  it("the worker-side predicate uses the identical context/database rule without reading cron credentials", () => {
    const settings = read();
    expect(currentNightLabTarget(() => context(), settings)?.origin).toBe(
      `https://${ID}--synthetic-site.netlify.app`,
    );
    expect(settings.mock.calls.map((row) => row[0])).toEqual(["SUPABASE_URL"]);
    expect(currentNightLabTarget(() => context(), read(PROD))).toBeNull();
  });
});
