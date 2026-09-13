import { inspectProductionDeployMetadata } from "./netlify-deployment.checks.mjs";
import { runProductionSmoke } from "./production-smoke.checks.mjs";

export const PRODUCTION_SITE = "0d17652b-c26c-4ada-9792-d332c7572536";
export const PRODUCTION_URL = "https://gyms.life";
export const RELEASE_CLI_VERSION = "27.5.2";
const deployPattern = /^[a-f0-9]{24}$/;
const shaPattern = /^[a-f0-9]{40}$/;
class ReleaseFailure extends Error {}
const requireCheck = (ok, code) => {
  if (!ok) throw new ReleaseFailure(code);
};

/** Explicit release only; the default path performs reads and public auth-guard probes. */
export async function runProductionRelease(options = {}, { command, smoke = runProductionSmoke }) {
  const { deploy = false, expectedSha } = options;
  const report = {
    ok: false,
    mode: deploy ? "deploy" : "verify",
    deploymentAttempted: false,
    previousDeployId: null,
    deployId: null,
    sourceHeadVerified: false,
    metadataVerified: false,
    executionVerified: false,
    codeIdentityVerified: false,
  };
  const run = async (file, args, code, production = false) => {
    try {
      return await command(file, args, { production });
    } catch {
      throw new ReleaseFailure(code);
    }
  };
  const ntl = (args, code, production = false) =>
    run("npx", ["--no-install", "netlify", ...args], code, production);
  const json = (text) => {
    try {
      return JSON.parse(text);
    } catch {
      throw new ReleaseFailure("CLI_JSON_INVALID");
    }
  };
  const api = async (method, data) =>
    json(await ntl(["api", method, "--data", JSON.stringify(data)], "METADATA_READ_FAILED"));
  const getSite = async () => {
    const site = await api("getSite", { site_id: PRODUCTION_SITE });
    requireCheck(
      site?.id === PRODUCTION_SITE && site?.ssl_url === PRODUCTION_URL,
      "PRODUCTION_SITE_MISMATCH",
    );
    requireCheck(
      typeof site?.published_deploy?.id === "string" &&
        deployPattern.test(site.published_deploy.id),
      "PUBLISHED_DEPLOY_MISSING",
    );
    return site;
  };
  const checkSource = async () => {
    const git = (args) => run("git", args, "SOURCE_READ_FAILED");
    const origin = (await git(["remote", "get-url", "origin"])).trim();
    requireCheck(
      [
        "https://github.com/smirnov0707/gyms-life.git",
        "https://github.com/smirnov0707/gyms-life",
        "git@github.com:smirnov0707/gyms-life.git",
      ].includes(origin),
      "REPOSITORY_MISMATCH",
    );
    requireCheck((await git(["rev-parse", "HEAD"])).trim() === expectedSha, "SOURCE_SHA_MISMATCH");
    requireCheck(
      !(await git(["status", "--porcelain", "--untracked-files=all"])).trim(),
      "WORKTREE_NOT_CLEAN",
    );
    const remote = (await git(["ls-remote", "origin", "refs/heads/main"])).trim();
    requireCheck(remote === `${expectedSha}\trefs/heads/main`, "REMOTE_MAIN_MISMATCH");
  };
  try {
    requireCheck(typeof deploy === "boolean", "RELEASE_OPTIONS_INVALID");
    requireCheck(
      deploy
        ? typeof expectedSha === "string" && shaPattern.test(expectedSha)
        : expectedSha === undefined,
      "RELEASE_OPTIONS_INVALID",
    );
    const version = (await ntl(["--version"], "NETLIFY_CLI_UNAVAILABLE")).trim().split(/\s+/)[0];
    requireCheck(version === `netlify/${RELEASE_CLI_VERSION}`, "UNVERIFIED_NETLIFY_CLI_VERSION");
    const before = await getSite();
    report.previousDeployId = before.published_deploy.id;
    if (deploy) {
      await checkSource();
      await run("node", ["scripts/verify-release-dependencies.mjs"], "DEPENDENCY_LAYOUT_UNSAFE");
      for (const task of ["typecheck", "test", "lint"])
        await run("npm", ["run", task], "QUALITY_GATE_FAILED");
      await checkSource();
      report.sourceHeadVerified = true;
      requireCheck(
        (await getSite()).published_deploy.id === report.previousDeployId,
        "PUBLISHED_DEPLOY_CHANGED_BEFORE_RELEASE",
      );
      report.deploymentAttempted = true;
      const uploaded = json(
        await ntl(
          [
            "deploy",
            "--prod",
            "--context",
            "production",
            "--skip-functions-cache",
            "--site",
            PRODUCTION_SITE,
            "--message",
            `Verified source ${expectedSha}`,
            "--json",
          ],
          "DEPLOY_COMMAND_FAILED_STATE_UNCONFIRMED",
          true,
        ),
      );
      requireCheck(
        uploaded?.site_id === PRODUCTION_SITE &&
          typeof uploaded?.deploy_id === "string" &&
          deployPattern.test(uploaded.deploy_id),
        "DEPLOY_RESPONSE_INVALID",
      );
      report.deployId = uploaded.deploy_id;
    } else report.deployId = report.previousDeployId;
    const site = await getSite();
    const deployed = await api("getDeploy", { deploy_id: report.deployId });
    const metadata = inspectProductionDeployMetadata(
      { site, deploy: deployed },
      { siteId: PRODUCTION_SITE, deployId: report.deployId },
    );
    report.metadataErrors = metadata.errors;
    requireCheck(metadata.ok, "DEPLOY_METADATA_INVALID");
    report.metadataVerified = true;
    requireCheck(
      (await getSite()).published_deploy.id === report.deployId,
      "PUBLISHED_DEPLOY_CHANGED_DURING_VERIFICATION",
    );
    report.smoke = await smoke({ base: PRODUCTION_URL });
    requireCheck(report.smoke.ok, "LIVE_SMOKE_FAILED");
    requireCheck(
      (await getSite()).published_deploy.id === report.deployId,
      "PUBLISHED_DEPLOY_CHANGED_DURING_VERIFICATION",
    );
    report.ok = true;
  } catch (error) {
    report.error =
      error instanceof ReleaseFailure ? error.message : "RELEASE_VERIFICATION_UNAVAILABLE";
  }
  // No automatic retry, rollback, secret operation, DB access or worker invocation.
  // A failed CLI call may have published; deploymentAttempted must remain visible.
  return report;
}
