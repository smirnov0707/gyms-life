import { describe, expect, it, vi } from "vitest";
import {
  PRODUCTION_SITE,
  PRODUCTION_URL,
  RELEASE_CLI_VERSION,
  runProductionRelease,
} from "./production-release.mjs";
const OLD = "a".repeat(24),
  NEXT = "b".repeat(24),
  SHA = "c".repeat(40);
function fixture() {
  const site = { id: PRODUCTION_SITE, ssl_url: PRODUCTION_URL, published_deploy: { id: OLD } };
  const deployed = {
    id: OLD,
    site_id: PRODUCTION_SITE,
    context: "production",
    state: "ready",
    published_at: "2026-09-13T09:29:13Z",
    available_functions: [
      { n: "server", im: "stream", bd: { runtimeAPIVersion: 2 }, ro: [{ p: "/*", ps: true }] },
      { n: "night-lab-worker-background", im: "background", bd: { runtimeAPIVersion: 2 } },
      { n: "night-lab", im: "stream", bd: { runtimeAPIVersion: 2 } },
    ],
    function_schedules: [{ name: "night-lab", cron: "10 3 * * *" }],
  };
  const state = {
    site,
    deployed,
    dirty: false,
    head: SHA,
    remote: SHA,
    origin: "https://github.com/smirnov0707/gyms-life.git",
    version: RELEASE_CLI_VERSION,
    onDeploy: () => {},
    onQuality: () => {},
    onSite: () => {},
  };
  const command = vi.fn(async (file, args) => {
    if (file === "git") {
      if (args[0] === "remote") return state.origin;
      if (args[0] === "rev-parse") return state.head;
      if (args[0] === "status") return state.dirty ? " M src/changed.ts\n" : "";
      if (args[0] === "ls-remote") return `${state.remote}\trefs/heads/main\n`;
    }
    if (file === "node") return "release runtime dependencies are local\n";
    if (file === "npm") {
      state.onQuality(args);
      return "";
    }
    if (file === "npx" && args[2] === "--version")
      return `netlify/${state.version} linux-x64 node-v22.0.0`;
    if (args[2] === "api") {
      if (args[3] === "getSite") {
        state.onSite();
        return JSON.stringify(state.site);
      }
      if (args[3] === "getDeploy") return JSON.stringify(state.deployed);
    }
    if (args[2] === "deploy") {
      state.site.published_deploy.id = NEXT;
      state.deployed.id = NEXT;
      state.onDeploy();
      return JSON.stringify({ site_id: PRODUCTION_SITE, deploy_id: NEXT });
    }
    throw new Error("Unexpected synthetic command");
  });
  const smoke = vi.fn(async () => ({ ok: true, executionVerified: false, results: [] }));
  return { state, command, smoke };
}
const publishCalls = (f) =>
  f.command.mock.calls.filter(([file, args]) => file === "npx" && args[2] === "deploy");
const release = (f) => runProductionRelease({ deploy: true, expectedSha: SHA }, f);

describe("guarded production release", () => {
  it("defaults to metadata reads and public smoke only; never invokes a worker", async () => {
    const f = fixture(),
      r = await runProductionRelease({}, f);
    expect(r).toMatchObject({
      ok: true,
      deploymentAttempted: false,
      metadataVerified: true,
      executionVerified: false,
      codeIdentityVerified: false,
      deployId: OLD,
    });
    expect(f.smoke).toHaveBeenCalledWith({ base: PRODUCTION_URL });
    expect(
      f.command.mock.calls.every(
        ([file, args]) => file === "npx" && ["--version", "api"].includes(args[2]),
      ),
    ).toBe(true);
    expect(publishCalls(f)).toHaveLength(0);
  });
  it.each([{}, { expectedSha: "invalid" }, { expectedSha: SHA + ";echo unsafe" }])(
    "refuses publication without exact SHA: %j",
    async (options) => {
      const f = fixture(),
        r = await runProductionRelease({ deploy: true, ...options }, f);
      expect(r.error).toBe("RELEASE_OPTIONS_INVALID");
      expect(f.command).not.toHaveBeenCalled();
    },
  );
  it.each([
    ["dirty", true, "WORKTREE_NOT_CLEAN"],
    ["head", "d".repeat(40), "SOURCE_SHA_MISMATCH"],
    ["remote", "d".repeat(40), "REMOTE_MAIN_MISMATCH"],
    ["origin", "https://foreign.invalid/repo", "REPOSITORY_MISMATCH"],
    ["version", "18.0.3", "UNVERIFIED_NETLIFY_CLI_VERSION"],
  ])("blocks unsafe %s before deployment", async (field, value, error) => {
    const f = fixture();
    f.state[field] = value;
    expect(await release(f)).toMatchObject({ ok: false, deploymentAttempted: false, error });
    expect(publishCalls(f)).toHaveLength(0);
  });
  it("blocks publication when runtime dependencies are not local to the release worktree", async () => {
    const f = fixture();
    const base = f.command;
    f.command = vi.fn(async (file, args, options) => {
      if (file === "node") throw new Error("external dependency");
      return base(file, args, options);
    });
    const r = await release(f);
    expect(r).toMatchObject({
      ok: false,
      deploymentAttempted: false,
      error: "DEPENDENCY_LAYOUT_UNSAFE",
    });
    expect(publishCalls(f)).toHaveLength(0);
  });

  it("uses the canonical adapter with quality and post-release metadata/smoke gates", async () => {
    const f = fixture(),
      r = await release(f);
    expect(r).toMatchObject({
      ok: true,
      deploymentAttempted: true,
      previousDeployId: OLD,
      deployId: NEXT,
      sourceHeadVerified: true,
      metadataVerified: true,
      executionVerified: false,
      codeIdentityVerified: false,
    });
    expect(
      f.command.mock.calls.filter(([file]) => file === "node").map(([, args]) => args),
    ).toEqual([["scripts/verify-release-dependencies.mjs"]]);
    expect(f.command.mock.calls.filter(([file]) => file === "npm").map(([, args]) => args)).toEqual(
      [
        ["run", "typecheck"],
        ["run", "test"],
        ["run", "lint"],
      ],
    );
    expect(publishCalls(f)).toEqual([
      [
        "npx",
        [
          "--no-install",
          "netlify",
          "deploy",
          "--prod",
          "--context",
          "production",
          "--skip-functions-cache",
          "--site",
          PRODUCTION_SITE,
          "--message",
          `Verified source ${SHA}`,
          "--json",
        ],
        { production: true },
      ],
    ]);
    expect(f.smoke).toHaveBeenCalledOnce();
    expect(JSON.stringify(f.command.mock.calls)).not.toMatch(
      /--functions|--no-build|--auth|env:set|restoreSiteDeploy/,
    );
  });
  it("stops if checks fail and never leaks command output", async () => {
    const f = fixture();
    f.state.onQuality = () => {
      throw new Error("PRIVATE_SECRET");
    };
    const r = await release(f);
    expect(r.error).toBe("QUALITY_GATE_FAILED");
    expect(JSON.stringify(r)).not.toContain("PRIVATE_SECRET");
    expect(publishCalls(f)).toHaveLength(0);
  });
  it("rechecks clean source after quality gates", async () => {
    const f = fixture();
    f.state.onQuality = () => {
      f.state.dirty = true;
    };
    expect((await release(f)).error).toBe("WORKTREE_NOT_CLEAN");
    expect(publishCalls(f)).toHaveLength(0);
  });
  it("refuses to replace a site that changed during quality gates", async () => {
    const f = fixture();
    f.state.onQuality = () => {
      f.state.site.published_deploy.id = NEXT;
    };
    expect((await release(f)).error).toBe("PUBLISHED_DEPLOY_CHANGED_BEFORE_RELEASE");
    expect(publishCalls(f)).toHaveLength(0);
  });
  it("rejects missing streaming/background modes after publication without an unsafe automatic rollback", async () => {
    const f = fixture();
    f.state.onDeploy = () => {
      delete f.state.deployed.available_functions[1].im;
    };
    const r = await release(f);
    expect(r).toMatchObject({
      ok: false,
      deploymentAttempted: true,
      deployId: NEXT,
      metadataVerified: false,
      error: "DEPLOY_METADATA_INVALID",
    });
    expect(r.metadataErrors).toContain("WORKER_BACKGROUND_MODE_MISSING");
    expect(f.smoke).not.toHaveBeenCalled();
    expect(publishCalls(f)).toHaveLength(1);
  });
  it("does not call a CLI timeout a successful deployment or retry it", async () => {
    const f = fixture();
    f.state.onDeploy = () => {
      throw new Error("PRIVATE_SECRET");
    };
    const r = await release(f);
    expect(r).toMatchObject({
      ok: false,
      deploymentAttempted: true,
      previousDeployId: OLD,
      error: "DEPLOY_COMMAND_FAILED_STATE_UNCONFIRMED",
    });
    expect(publishCalls(f)).toHaveLength(1);
    expect(JSON.stringify(r)).not.toContain("PRIVATE_SECRET");
  });
  it("fails live smoke even when metadata is ready", async () => {
    const f = fixture();
    f.smoke.mockResolvedValue({ ok: false, executionVerified: false, results: [] });
    expect(await release(f)).toMatchObject({
      ok: false,
      metadataVerified: true,
      error: "LIVE_SMOKE_FAILED",
    });
  });
  it("detects publication races during smoke", async () => {
    const f = fixture();
    f.smoke.mockImplementation(async () => {
      f.state.site.published_deploy.id = NEXT;
      return { ok: true };
    });
    expect((await runProductionRelease({}, f)).error).toBe(
      "PUBLISHED_DEPLOY_CHANGED_DURING_VERIFICATION",
    );
  });
  it.each(["id", "ssl_url"])("rejects a foreign production site %s", async (field) => {
    const f = fixture();
    f.state.site[field] = "foreign";
    expect((await release(f)).error).toBe("PRODUCTION_SITE_MISMATCH");
    expect(publishCalls(f)).toHaveLength(0);
  });
  it("rejects an unreadable published pointer", async () => {
    const f = fixture();
    f.state.site.published_deploy = null;
    expect((await runProductionRelease({}, f)).error).toBe("PUBLISHED_DEPLOY_MISSING");
  });
  it("rejects malformed CLI metadata without exposing it", async () => {
    const f = fixture(),
      original = f.command.getMockImplementation();
    f.command.mockImplementation((file, args, options) =>
      args[3] === "getSite" ? "PRIVATE_SECRET" : original(file, args, options),
    );
    const r = await runProductionRelease({}, f);
    expect(r.error).toBe("CLI_JSON_INVALID");
    expect(JSON.stringify(r)).not.toContain("PRIVATE_SECRET");
  });
  it("rejects a different deployment becoming current before metadata capture", async () => {
    const f = fixture();
    f.state.onDeploy = () => {
      f.state.site.published_deploy.id = OLD;
    };
    const r = await release(f);
    expect(r.error).toBe("DEPLOY_METADATA_INVALID");
    expect(r.metadataErrors).toContain("NOT_CURRENT_PUBLISHED_DEPLOY");
  });
  it("does not mislabel successful public checks as execution or code attestation", async () => {
    const f = fixture();
    f.state.deployed.commit_ref = null;
    const r = await runProductionRelease({}, f);
    expect(r.ok).toBe(true);
    expect(r.executionVerified).toBe(false);
    expect(r.codeIdentityVerified).toBe(false);
  });
});
