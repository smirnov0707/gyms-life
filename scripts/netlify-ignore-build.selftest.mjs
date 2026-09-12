import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const script = resolve("scripts/netlify-ignore-build.mjs");
const repo = mkdtempSync(join(tmpdir(), "gyms-life-netlify-gate-"));

function git(...args) {
  return execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
}

function run(env) {
  return spawnSync(process.execPath, [script], {
    cwd: repo,
    env: { ...process.env, ...env },
    encoding: "utf8",
  }).status;
}

try {
  git("init", "-q");
  git("config", "user.email", "release-gate@gyms.life");
  git("config", "user.name", "GYMS.LIFE Release Gate");
  writeFileSync(join(repo, "fixture.txt"), "one\n");
  git("add", "fixture.txt");
  git("commit", "-qm", "ordinary change");
  const ordinary = git("rev-parse", "HEAD");

  assert.equal(run({ CONTEXT: "deploy-preview", COMMIT_REF: ordinary }), 1);
  assert.equal(run({ CONTEXT: "branch-deploy", COMMIT_REF: ordinary }), 1);
  assert.equal(run({ CONTEXT: "production", COMMIT_REF: ordinary }), 0);
  assert.equal(run({ CONTEXT: "production", COMMIT_REF: "missing-ref" }), 0);
  assert.equal(run({ CONTEXT: "production", COMMIT_REF: ordinary, GYMSLIFE_RELEASE: "1" }), 1);

  writeFileSync(join(repo, "fixture.txt"), "two\n");
  git("add", "fixture.txt");
  git("commit", "-qm", "Release Twin improvements [release production]");
  const release = git("rev-parse", "HEAD");
  assert.equal(run({ CONTEXT: "production", COMMIT_REF: release }), 1);

  console.log("Netlify production release gate self-test passed.");
} finally {
  rmSync(repo, { recursive: true, force: true });
}
