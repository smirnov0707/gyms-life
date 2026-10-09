import { spawnSync } from "node:child_process";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SEVERITIES = ["info", "low", "moderate", "high", "critical"];
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const count = (value) => Number.isSafeInteger(value) && value >= 0;
const unavailable = (reason) => ({ state: "unavailable", reason, counts: null });

/** A valid report with findings is different from a report we could not obtain. */
export function inspectAudit({ stdout, status, signal = null, errorCode = null }) {
  if (errorCode || signal || (status !== 0 && status !== 1))
    return unavailable("audit_process_failed");
  let report;
  try {
    report = JSON.parse(stdout);
  } catch {
    return unavailable("invalid_json");
  }
  if (!record(report) || report.error != null) return unavailable("registry_error");
  if (report.auditReportVersion !== 2) return unavailable("unsupported_report_version");
  const counts = report.metadata?.vulnerabilities;
  if (!record(counts) || !record(report.vulnerabilities) || !record(report.metadata?.dependencies))
    return unavailable("missing_report_data");
  const dependencies = report.metadata.dependencies;
  if (
    !["prod", "dev", "optional", "peer", "peerOptional", "total"].every((key) =>
      count(dependencies[key]),
    )
  )
    return unavailable("invalid_dependency_counts");
  if (![...SEVERITIES, "total"].every((key) => count(counts[key])))
    return unavailable("invalid_counts");
  if (SEVERITIES.reduce((sum, key) => sum + counts[key], 0) !== counts.total)
    return unavailable("inconsistent_counts");
  const observed = Object.fromEntries(SEVERITIES.map((severity) => [severity, 0]));
  const findings = Object.values(report.vulnerabilities);
  for (const finding of findings) {
    if (
      !record(finding) ||
      typeof finding.name !== "string" ||
      !finding.name.trim() ||
      !SEVERITIES.includes(finding.severity) ||
      !Array.isArray(finding.nodes) ||
      !finding.nodes.length ||
      !finding.nodes.every((node) => typeof node === "string" && node.length > 0) ||
      !Array.isArray(finding.via) ||
      !finding.via.length ||
      !finding.via.every(
        (via) =>
          (typeof via === "string" && via.length > 0) ||
          (record(via) &&
            typeof via.name === "string" &&
            via.name.length > 0 &&
            typeof via.title === "string" &&
            via.title.length > 0 &&
            SEVERITIES.includes(via.severity)),
      )
    )
      return unavailable("invalid_finding");
    observed[finding.severity]++;
  }
  if (findings.length !== counts.total || !SEVERITIES.every((key) => observed[key] === counts[key]))
    return unavailable("inconsistent_findings");
  // --audit-level changes the exit threshold, not which findings npm reports.
  const blockingCount = counts.moderate + counts.high + counts.critical;
  if (status !== (blockingCount > 0 ? 1 : 0)) return unavailable("inconsistent_exit_status");
  return {
    state: counts.total === 0 ? "clear" : "findings",
    reason: null,
    counts: Object.fromEntries([...SEVERITIES, "total"].map((key) => [key, counts[key]])),
    blockingCount,
  };
}

export function auditArguments(scope) {
  if (scope !== "production" && scope !== "all") throw new Error("Unknown audit scope");
  return [
    "audit",
    "--json",
    "--audit-level=moderate",
    "--include=prod",
    "--include=optional",
    "--include=peer",
    scope === "all" ? "--include=dev" : "--omit=dev",
  ];
}

export function executeAudit(scope, cwd) {
  const result = spawnSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    auditArguments(scope),
    {
      cwd,
      encoding: "utf8",
      timeout: 90_000,
      killSignal: "SIGKILL",
      maxBuffer: 16 * 1024 * 1024,
      shell: false,
    },
  );
  return {
    stdout: typeof result.stdout === "string" ? result.stdout : "",
    status: result.status,
    signal: result.signal,
    // Do not print untrusted registry/process text into GitHub workflow commands.
    errorCode: result.error ? "npm_execution_error" : null,
  };
}

export function summarizeAudits(results) {
  const production = results.find((result) => result.scope === "production");
  const all = results.find((result) => result.scope === "all");
  const complete =
    results.length === 2 &&
    production &&
    all &&
    results.every((result) => result.state !== "unavailable");
  return {
    schemaVersion: 1,
    passed: Boolean(complete && production.blockingCount === 0),
    policy:
      "Production moderate+ findings block; full-tree findings remain recorded. An unavailable audit always blocks.",
    results,
  };
}

/** Always attempt both scopes, even if the first contains findings or cannot run. */
export async function runAudits({
  cwd = process.cwd(),
  outputDirectory = path.join(cwd, "test-results/dependency-security"),
  execute = executeAudit,
} = {}) {
  await mkdir(outputDirectory, { recursive: true });
  // Invalidate previous receipts before starting; a killed process cannot leave a stale green result.
  await writeFile(
    path.join(outputDirectory, "audit-status.json"),
    JSON.stringify(
      {
        schemaVersion: 1,
        passed: false,
        state: "running",
        results: [],
      },
      null,
      2,
    ),
  );
  for (const scope of ["production", "all"])
    await writeFile(path.join(outputDirectory, `audit-${scope}.json`), "");
  const results = [];
  for (const scope of ["production", "all"]) {
    let run;
    try {
      run = await execute(scope, cwd);
    } catch {
      run = { stdout: "", status: null, errorCode: "audit_execution_threw" };
    }
    const result = { scope, ...inspectAudit(run) };
    results.push(result);
    // Retain raw registry JSON, including failed responses, separately from trusted status.
    await writeFile(path.join(outputDirectory, `audit-${scope}.json`), run.stdout);
    await writeFile(
      path.join(outputDirectory, "audit-status.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          passed: false,
          state: "running",
          results,
        },
        null,
        2,
      ),
    );
  }
  const summary = summarizeAudits(results);
  await writeFile(
    path.join(outputDirectory, "audit-status.json"),
    JSON.stringify(summary, null, 2),
  );
  return summary;
}

export function formatAuditSummary(summary) {
  const lines = [
    "## Dependency audit verification",
    "",
    "| Scope | Result | Package findings |",
    "|---|---|---|",
  ];
  for (const result of summary.results) {
    const text =
      result.state === "unavailable"
        ? `UNAVAILABLE (${result.reason})`
        : result.blockingCount > 0 && result.scope === "production"
          ? "BLOCKED"
          : result.state === "findings"
            ? "FINDINGS RECORDED"
            : "CLEAR";
    lines.push(`| ${result.scope} | ${text} | ${result.counts?.total ?? "not known"} |`);
  }
  lines.push(
    "",
    summary.policy,
    "",
    "A clear registry audit is not a complete security assessment; development tooling can affect builds.",
    "",
  );
  return lines.join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const summary = await runAudits();
    console.log(formatAuditSummary(summary));
    if (process.env.GITHUB_STEP_SUMMARY)
      await appendFile(process.env.GITHUB_STEP_SUMMARY, formatAuditSummary(summary));
    for (const result of summary.results) {
      if (result.state === "unavailable")
        console.error(
          `::error::Dependency audit unavailable for ${result.scope}: ${result.reason}`,
        );
      else if (result.scope === "all" && result.counts.total > 0)
        console.warn(
          `::warning::Full dependency audit retains ${result.counts.total} package-level findings. Review the retained report; these are not suppressed.`,
        );
    }
    process.exitCode = summary.passed ? 0 : 1;
  } catch {
    console.error("::error::Dependency audit could not complete or retain its evidence.");
    process.exitCode = 1;
  }
}
