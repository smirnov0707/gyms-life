import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readApplicationBuild,
  checkBrowserEnvironment,
  checkServerEnvironment,
  publicKeyMatches,
  projectOriginMatches,
  type ApplicationBuild,
} from "./application-environment";
import { createApplicationBuild } from "../../scripts/application-environment.build";
import {
  withApplicationEnvironment,
  currentApplicationEnvironment,
} from "./application-environment.server";
import { applySecurityHeaders } from "./security-headers.server";
const sdk = vi.hoisted(() => ({ context: vi.fn() }));
vi.mock("@netlify/functions", () => ({ getContext: sdk.context }));
const SITE = "0d17652b-c26c-4ada-9792-d332c7572536",
  NAME = "singular-vacherin-57448d",
  PROD = "tqwqbjkjqzusohxdzupr",
  STAGE = "yywnpovsqifwujuxdxog",
  ID = "a".repeat(24),
  SHA = "a".repeat(40),
  KEY = "sb_publishable_synthetic0123456789012345";
const build = (
  context: "production" | "deploy-preview" | "branch-deploy" = "deploy-preview",
): ApplicationBuild => ({
  provider: "netlify",
  context,
  target: context === "production" ? "production" : "staging",
  projectRef: context === "production" ? PROD : STAGE,
  siteId: SITE,
  siteName: NAME,
  sourceCommit: SHA,
});
const runtime = (context = "deploy-preview", published = false) => ({
  deploy: { id: ID, context, published },
  site: { id: SITE, name: NAME },
});
const preview = `https://${ID}--${NAME}.netlify.app`;
const source = (
  context: "production" | "deploy-preview" | "branch-deploy" = "deploy-preview",
  published = false,
) => ({
  build: build(context),
  context: runtime(context, published),
  databaseUrl: `https://${context === "production" ? PROD : STAGE}.supabase.co`,
});
const env = (context = "deploy-preview") => ({
  NETLIFY: "true",
  CONTEXT: context,
  SITE_ID: SITE,
  SITE_NAME: NAME,
  COMMIT_REF: SHA,
  VITE_SUPABASE_URL: `https://${context === "production" ? PROD : STAGE}.supabase.co`,
  VITE_SUPABASE_PROJECT_ID: context === "production" ? PROD : STAGE,
  SUPABASE_URL: `https://${context === "production" ? PROD : STAGE}.supabase.co`,
  SUPABASE_PROJECT_ID: context === "production" ? PROD : STAGE,
  VITE_SUPABASE_PUBLISHABLE_KEY: KEY,
  SUPABASE_PUBLISHABLE_KEY: KEY,
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe("build-time environment identity", () => {
  it.each(["production", "deploy-preview", "branch-deploy"])(
    "binds %s to explicit same-site same-project public configuration",
    (context) => {
      const result = createApplicationBuild(env(context));
      expect(result).toMatchObject({
        provider: "netlify",
        target: context === "production" ? "production" : "staging",
        sourceCommit: SHA,
      });
      expect(JSON.stringify(result)).not.toContain(KEY);
    },
  );
  it.each(["VITE_SUPABASE_URL", "SUPABASE_URL"] as const)(
    "inherited production %s cannot build a staging client",
    (key) => {
      const variables = env();
      variables[key] = `https://${PROD}.supabase.co`;
      expect(() => createApplicationBuild(variables)).toThrow(/APP_BUILD_.*TARGET_MISMATCH/);
    },
  );
  it.each(["VITE_SUPABASE_PROJECT_ID", "SUPABASE_PROJECT_ID"] as const)(
    "cannot retain a misleading %s",
    (key) => {
      const variables = env();
      variables[key] = PROD;
      expect(() => createApplicationBuild(variables)).toThrow(/TARGET_MISMATCH/);
    },
  );
  it.each(["SITE_NAME", "SITE_ID", "COMMIT_REF"] as const)(
    "requires explicit verified %s",
    (key) => {
      const variables = env();
      variables[key] = "";
      expect(() => createApplicationBuild(variables)).toThrow();
    },
  );
  it.each([undefined, "unknown", "preview-server"])(
    "cannot infer production from missing/unapproved managed context %s",
    (context) => {
      expect(() => createApplicationBuild({ ...env(), CONTEXT: context })).toThrow(
        "APP_BUILD_CONTEXT_UNVERIFIED",
      );
    },
  );
  it("local checks do not pretend to be a deployed release", () => {
    expect(createApplicationBuild({})).toEqual({ provider: "local", target: "local" });
    expect(createApplicationBuild({ CONTEXT: "dev" })).toEqual({
      provider: "local",
      target: "local",
    });
  });
  it.each(["sb_secret_synthetic0123456789012345", "****", "anonymous-but-not-a-key"])(
    "rejects secret/redacted/malformed browser values without echoing them",
    (key) => {
      expect(() =>
        createApplicationBuild({ ...env(), VITE_SUPABASE_PUBLISHABLE_KEY: key }),
      ).toThrow("APP_BUILD_PUBLIC_KEY_INVALID");
    },
  );
  it("validates old public JWT metadata but never treats that as signature verification", () => {
    const jwt = (role: string, ref: string) =>
      `header.${btoa(JSON.stringify({ role, ref }))}.signature`;
    expect(publicKeyMatches(jwt("anon", STAGE), STAGE)).toBe(true);
    expect(publicKeyMatches(jwt("anon", PROD), STAGE)).toBe(false);
    expect(publicKeyMatches(jwt("service_role", STAGE), STAGE)).toBe(false);
  });
});
describe("client origin is a restriction, never a DB selector", () => {
  it.each([
    "https://gyms.life/auth",
    `https://${NAME}.netlify.app/auth`,
    `https://main--${NAME}.netlify.app/auth`,
    "https://www.gyms.life/auth",
  ])("rejects staging on production-facing origin %s", (url) => {
    expect(checkBrowserEnvironment(build(), url).allowed).toBe(false);
    expect(checkBrowserEnvironment(build("production"), url).allowed).toBe(true);
  });
  it.each([preview, `https://deploy-preview-61--${NAME}.netlify.app`])(
    "allows its real immutable/PR preview %s",
    (url) => {
      expect(
        checkBrowserEnvironment(build(), url + "/auth", `https://${STAGE}.supabase.co/`).allowed,
      ).toBe(true);
    },
  );
  it.each([
    "https://evil.invalid",
    `${preview}.evil.invalid`,
    preview.replace("https:", "http:"),
    preview + ":8443",
    preview.replace("https://", "https://user:pass@"),
    `https://other--another-site.netlify.app`,
    "data:text/html,test",
  ])("rejects an unrelated or malformed origin %s", (url) =>
    expect(checkBrowserEnvironment(build(), url).allowed).toBe(false),
  );
  it("does not turn an old local artifact into a hosted build", () => {
    expect(
      checkBrowserEnvironment({ provider: "local", target: "local" }, "https://gyms.life").allowed,
    ).toBe(false);
    expect(
      checkBrowserEnvironment({ provider: "local", target: "local" }, "http://127.0.0.1:3000/auth")
        .allowed,
    ).toBe(true);
  });
  it("branch previews cannot borrow main or PR aliases", () => {
    expect(
      checkBrowserEnvironment(build("branch-deploy"), `https://feature--${NAME}.netlify.app`)
        .allowed,
    ).toBe(true);
    expect(
      checkBrowserEnvironment(build("branch-deploy"), `https://main--${NAME}.netlify.app`).allowed,
    ).toBe(false);
    expect(
      checkBrowserEnvironment(
        build("branch-deploy"),
        `https://deploy-preview-61--${NAME}.netlify.app`,
      ).allowed,
    ).toBe(false);
  });
  it("bad metadata and wrong DB are rejected instead of guessed", () => {
    expect(readApplicationBuild("broken")).toBeNull();
    expect(readApplicationBuild({ ...build(), target: "production" })).toBeNull();
    expect(checkBrowserEnvironment(build(), preview, `https://${PROD}.supabase.co`)).toMatchObject({
      issue: "database_target_mismatch",
    });
  });
  it.each([
    `https://${STAGE}.supabase.co/path`,
    `https://${STAGE}.supabase.co?x=1`,
    `https://u:p@${STAGE}.supabase.co`,
    `http://${STAGE}.supabase.co`,
  ])("rejects malformed project endpoint %s", (url) =>
    expect(projectOriginMatches(url, STAGE)).toBe(false),
  );
});
describe("server guard executes before lazy framework/data access", () => {
  it.each(["/auth", "/app", "/_serverFn/test", "/api/public/test"])(
    "published staging %s cannot reach an app handler",
    async (route) => {
      const action = vi.fn().mockResolvedValue(new Response("SHOULD NOT RUN"));
      const result = await withApplicationEnvironment(
        new Request("https://gyms.life" + route),
        action,
        () => source("deploy-preview", true),
      );
      expect(result.status).toBe(503);
      expect(action).not.toHaveBeenCalled();
      expect(result.headers.get("cache-control")).toContain("no-store");
      expect(await result.text()).not.toContain("<script");
    },
  );
  it("published preview is blocked even on its immutable link", () => {
    expect(
      checkServerEnvironment(
        build(),
        preview,
        runtime("deploy-preview", true),
        `https://${STAGE}.supabase.co`,
      ),
    ).toMatchObject({ issue: "preview_published" });
  });
  it("valid current production and standalone preview still run normally", async () => {
    for (const [url, metadata] of [
      ["https://gyms.life/auth", source("production", true)],
      [preview + "/auth", source()],
    ] as const) {
      const perform = vi.fn().mockResolvedValue(new Response("ok"));
      expect(
        (await withApplicationEnvironment(new Request(url), perform, () => metadata)).status,
      ).toBe(200);
      expect(perform).toHaveBeenCalledOnce();
    }
  });
  it.each([null, {}, { deploy: { id: ID, context: "deploy-preview", published: false } }])(
    "missing runtime %j fails closed",
    (value) => {
      expect(
        checkServerEnvironment(build(), preview, value, `https://${STAGE}.supabase.co`).allowed,
      ).toBe(false);
    },
  );
  it("context, site or database mismatch never reaches the handler", async () => {
    const invalid = [
      { ...source(), context: runtime("production", true) },
      { ...source(), context: { ...runtime(), site: { id: SITE, name: "other" } } },
      { ...source(), databaseUrl: `https://${PROD}.supabase.co` },
    ];
    for (const item of invalid) {
      const perform = vi.fn();
      expect(
        (await withApplicationEnvironment(new Request(preview), perform, () => item)).status,
      ).toBe(503);
      expect(perform).not.toHaveBeenCalled();
    }
  });
  it("a deliberately spoofed localhost request cannot legitimize a local artifact on a hosted runtime", () => {
    expect(
      checkServerEnvironment(
        { provider: "local", target: "local" },
        "http://localhost",
        runtime(),
        undefined,
      ),
    ).toMatchObject({ issue: "build_unverified" });
  });
  it("a read-only diagnostic reports compatibility, not authentication success", async () => {
    const action = vi.fn();
    const response = await withApplicationEnvironment(
      new Request(preview + "/api/public/environment"),
      action,
      () => source(),
    );
    expect(await response.json()).toMatchObject({
      status: "compatible",
      target: "staging",
      sourceCommit: SHA,
      scope: "deployment_identity_only_not_authentication_or_database_acceptance",
    });
    expect(action).not.toHaveBeenCalled();
  });
  it("runtime metadata comes from the SDK, not host/env guesses", () => {
    vi.stubEnv("VITE_GYMSLIFE_BUILD", JSON.stringify(build()));
    sdk.context.mockReturnValue(runtime());
    vi.stubGlobal("Netlify", { env: { get: vi.fn(() => `https://${STAGE}.supabase.co`) } });
    expect(currentApplicationEnvironment()).toEqual(source());
  });
  it("blocked response CSP remains stricter after common security headers", async () => {
    const response = applySecurityHeaders(
      await withApplicationEnvironment(
        new Request("https://gyms.life/auth", { headers: { "accept-language": "lt" } }),
        vi.fn(),
        () => source(),
      ),
    );
    expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
    const body = await response.text();
    expect(body).toContain("Įrenginyje saugomi treniruočių įrašai nepakeisti");
    expect(body).not.toContain("form method");
    expect(body).not.toContain(STAGE);
  });
});
