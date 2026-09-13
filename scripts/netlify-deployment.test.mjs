import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { inspectProductionDeployMetadata } from "./netlify-deployment.checks.mjs";
const expected = { siteId: "11111111-1111-4111-8111-111111111111", deployId: "a".repeat(24) };
function fixture() {
  return {
    site: { id: expected.siteId, published_deploy: { id: expected.deployId } },
    deploy: {
      id: expected.deployId,
      site_id: expected.siteId,
      context: "production",
      state: "ready",
      published_at: "2026-09-13T09:29:13.090Z",
      error_message: null,
      commit_ref: null,
      available_functions: [
        {
          n: "server",
          im: "stream",
          bd: { runtimeAPIVersion: 2 },
          d: "hash-unchanged",
          ro: [{ p: "/*", ps: true, m: null }],
        },
        { n: "night-lab-worker-background", im: "background", bd: { runtimeAPIVersion: 2 } },
        { n: "night-lab", im: "stream", bd: { runtimeAPIVersion: 2 } },
      ],
      function_schedules: [{ name: "night-lab", cron: "10 3 * * *" }],
    },
  };
}
const inspect = (snapshot) => inspectProductionDeployMetadata(snapshot, expected);
describe("Netlify publication metadata contract", () => {
  it("verifies metadata without claiming code identity or real worker execution", () => {
    expect(inspect(fixture())).toEqual({
      ok: true,
      metadataVerified: true,
      executionVerified: false,
      codeIdentityVerified: false,
      errors: [],
    });
  });
  it.each([null, undefined, [], 1, "metadata", {}, { site: {}, deploy: null }])(
    "fails closed for malformed metadata %#",
    (value) => expect(inspect(value).ok).toBe(false),
  );
  it.each([null, {}, { siteId: expected.siteId }, { ...expected, deployId: "unknown" }])(
    "requires independent expected identifiers %#",
    (value) => {
      expect(inspectProductionDeployMetadata(fixture(), value).errors).toContain(
        "EXPECTED_IDS_INVALID",
      );
    },
  );
  it.each([
    ["site_id", "foreign", "DEPLOY_SITE_MISMATCH"],
    ["id", "b".repeat(24), "DEPLOY_ID_MISMATCH"],
    ["context", "deploy-preview", "DEPLOY_NOT_READY_PRODUCTION"],
    ["state", "building", "DEPLOY_NOT_READY_PRODUCTION"],
    ["published_at", null, "PUBLICATION_TIME_MISSING"],
    ["published_at", "not a date", "PUBLICATION_TIME_MISSING"],
    ["error_message", "PRIVATE_SENTINEL", "DEPLOY_NOT_READY_PRODUCTION"],
  ])("rejects incorrect deploy %s", (field, value, code) => {
    const snapshot = fixture();
    snapshot.deploy[field] = value;
    const report = inspect(snapshot);
    expect(report.errors).toContain(code);
    expect(JSON.stringify(report)).not.toContain("PRIVATE_SENTINEL");
  });
  it("rejects a previously published deploy after another deploy becomes active", () => {
    const snapshot = fixture();
    snapshot.site.published_deploy.id = "b".repeat(24);
    expect(inspect(snapshot).errors).toContain("NOT_CURRENT_PUBLISHED_DEPLOY");
  });
  it("does not accept metadata from another site", () => {
    const snapshot = fixture();
    snapshot.site.id = "22222222-2222-4222-8222-222222222222";
    expect(inspect(snapshot).errors).toContain("SITE_ID_MISMATCH");
  });
  it.each([0, 1, 2])("rejects missing or duplicate required function %s", (index) => {
    const missing = fixture();
    missing.deploy.available_functions.splice(index, 1);
    expect(inspect(missing).ok).toBe(false);
    const duplicate = fixture();
    duplicate.deploy.available_functions.push(duplicate.deploy.available_functions[index]);
    expect(inspect(duplicate).ok).toBe(false);
  });
  it.each([
    [0, "im", undefined, "SSR_STREAM_MODE_MISSING"],
    [0, "bd", null, "SSR_RUNTIME_API_V2_MISSING"],
    [1, "im", "stream", "WORKER_BACKGROUND_MODE_MISSING"],
    [1, "bd", { runtimeAPIVersion: 1 }, "WORKER_RUNTIME_API_V2_MISSING"],
    [2, "im", undefined, "SCHEDULER_INVOCATION_MODE_MISSING"],
    [2, "bd", null, "SCHEDULER_RUNTIME_API_V2_MISSING"],
  ])(
    "rejects lost runtime metadata %s/%s even if hashes are unchanged",
    (index, key, value, code) => {
      const snapshot = fixture();
      snapshot.deploy.available_functions[index][key] = value;
      expect(inspect(snapshot).errors).toContain(code);
    },
  );
  it.each([
    null,
    [],
    [{ p: "/wrong", ps: true }],
    [{ p: "/*", ps: false }],
    [{ p: "/*", ps: true, m: ["GET"] }],
  ])("requires complete SSR routing %#", (routes) => {
    const snapshot = fixture();
    snapshot.deploy.available_functions[0].ro = routes;
    expect(inspect(snapshot).errors).toContain("SSR_CATCH_ALL_ROUTE_MISSING");
  });
  it.each([
    null,
    [],
    [{ name: "night-lab", cron: "* * * * *" }],
    [
      { name: "night-lab", cron: "10 3 * * *" },
      { name: "night-lab", cron: "10 3 * * *" },
    ],
  ])("rejects absent, altered or duplicate schedules %#", (schedules) => {
    const snapshot = fixture();
    snapshot.deploy.function_schedules = schedules;
    expect(inspect(snapshot).errors).toContain("NIGHT_LAB_SCHEDULE_INVALID");
  });
  it("does not allow the long-running worker itself to become scheduled", () => {
    const snapshot = fixture();
    snapshot.deploy.function_schedules.push({
      name: "night-lab-worker-background",
      cron: "10 3 * * *",
    });
    expect(inspect(snapshot).errors).toContain("BACKGROUND_WORKER_MUST_NOT_BE_SCHEDULED");
  });
  it("ignores unrelated fields and never echoes their contents", () => {
    const snapshot = fixture();
    snapshot.site.unrelated = "PRIVATE_SENTINEL";
    snapshot.deploy.available_functions.push({ n: "emails" });
    const report = inspect(snapshot);
    expect(report.ok).toBe(true);
    expect(JSON.stringify(report)).not.toContain("PRIVATE_SENTINEL");
  });
});
describe("offline metadata CLI", () => {
  const cli = resolve("scripts/verify-netlify-deployment.mjs");
  const run = (args) =>
    spawnSync(process.execPath, [cli, ...args], { encoding: "utf8", timeout: 10000 });
  it("requires a snapshot and exact expected identifiers", () => {
    expect(run([]).status).toBe(1);
  });
  it("fails cleanly on unreadable files without printing the path or contents", () => {
    const child = run(["/does-not-exist/PRIVATE_SENTINEL", expected.siteId, expected.deployId]);
    expect(child.status).toBe(1);
    expect(child.stderr).not.toContain("PRIVATE_SENTINEL");
  });
  it("accepts a valid snapshot and rejects corruption without networking", () => {
    const directory = mkdtempSync(join(tmpdir(), "gyms-deploy-contract-"));
    try {
      const file = join(directory, "metadata.json");
      writeFileSync(file, JSON.stringify(fixture()));
      const pass = run([file, expected.siteId, expected.deployId]);
      expect(pass.status).toBe(0);
      expect(JSON.parse(pass.stdout)).toMatchObject({
        metadataVerified: true,
        executionVerified: false,
      });
      writeFileSync(file, "PRIVATE_SENTINEL invalid JSON");
      const fail = run([file, expected.siteId, expected.deployId]);
      expect(fail.status).toBe(1);
      expect(fail.stderr).not.toContain("PRIVATE_SENTINEL");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
