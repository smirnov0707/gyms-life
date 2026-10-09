import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir, chmod, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import {
  auditArguments,
  formatAuditSummary,
  inspectAudit,
  runAudits,
  summarizeAudits,
} from "./dependency-audits.mjs";

function report(severities = []) {
  const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: severities.length };
  const vulnerabilities = {};
  severities.forEach((severity, index) => {
    counts[severity]++;
    const name = `synthetic-${index}`;
    vulnerabilities[name] = {
      name,
      severity,
      nodes: [`node_modules/${name}`],
      via: [{ name, severity, title: "Synthetic finding", source: index + 1 }],
      effects: [],
      range: "*",
      fixAvailable: false,
    };
  });
  return {
    auditReportVersion: 2,
    vulnerabilities,
    metadata: {
      vulnerabilities: counts,
      dependencies: { prod: 4, dev: 6, optional: 0, peer: 0, peerOptional: 0, total: 10 },
    },
  };
}
function response(data, overrides = {}) {
  const count = data.metadata?.vulnerabilities;
  return {
    stdout: JSON.stringify(data),
    status: count && count.moderate + count.high + count.critical > 0 ? 1 : 0,
    signal: null,
    errorCode: null,
    ...overrides,
  };
}

for (const severity of ["info", "low", "moderate", "high", "critical"]) {
  test(`keeps ${severity} findings and the original moderate exit threshold`, () => {
    const result = inspectAudit(response(report([severity])));
    assert.equal(result.state, "findings");
    assert.equal(result.counts[severity], 1);
    assert.equal(result.blockingCount, ["moderate", "high", "critical"].includes(severity) ? 1 : 0);
  });
}
test("accepts a complete clean v2 report", () =>
  assert.equal(inspectAudit(response(report())).state, "clear"));
test("accepts propagated package entries without inflating root advisory counts", () => {
  const data = report(["high", "high"]);
  data.vulnerabilities["synthetic-1"].via = ["synthetic-0"];
  assert.equal(inspectAudit(response(data)).counts.total, 2);
});
for (const [name, change] of [
  ["network error with apparently complete stdout", { errorCode: "ECONNRESET" }],
  ["timeout", { status: null, errorCode: "ETIMEDOUT" }],
  ["output overflow", { errorCode: "ENOBUFS" }],
  ["signal", { signal: "SIGKILL" }],
  ["exit 2", { status: 2 }],
  ["missing exit status", { status: null }],
  ["empty JSON", { stdout: "" }],
  ["truncated JSON", { stdout: '{"auditReportVersion":2,' }],
  ["registry HTML", { stdout: "<html>502</html>" }],
  ["top-level array", { stdout: "[]" }],
  ["top-level null", { stdout: "null" }],
  ["missing schema", { stdout: "{}" }],
  ["clean report with failed exit", { status: 1 }],
]) {
  test(`does not call ${name} a clean audit`, () => {
    const result = inspectAudit(response(report(), change));
    assert.equal(result.state, "unavailable");
    assert.equal(result.counts, null);
  });
}
for (const [name, mutate] of [
  [
    "npm registry error",
    (data) => {
      data.error = { code: "E503" };
    },
  ],
  [
    "unsupported report version",
    (data) => {
      data.auditReportVersion = 3;
    },
  ],
  [
    "missing dependencies",
    (data) => {
      delete data.metadata.dependencies;
    },
  ],
  [
    "invalid dependency total",
    (data) => {
      data.metadata.dependencies.total = "10";
    },
  ],
  [
    "missing findings object",
    (data) => {
      delete data.vulnerabilities;
    },
  ],
  [
    "negative count",
    (data) => {
      data.metadata.vulnerabilities.low = -1;
    },
  ],
  [
    "string count",
    (data) => {
      data.metadata.vulnerabilities.high = "1";
    },
  ],
  [
    "unsafe count",
    (data) => {
      data.metadata.vulnerabilities.total = 1e30;
    },
  ],
  [
    "fractional count",
    (data) => {
      data.metadata.vulnerabilities.low = 0.5;
    },
  ],
  [
    "total mismatch",
    (data) => {
      data.metadata.vulnerabilities.total = 0;
    },
  ],
  [
    "missing severity count",
    (data) => {
      delete data.metadata.vulnerabilities.info;
    },
  ],
  [
    "severity mismatch",
    (data) => {
      data.vulnerabilities["synthetic-0"].severity = "critical";
    },
  ],
  [
    "unknown severity",
    (data) => {
      data.vulnerabilities["synthetic-0"].severity = "unknown";
    },
  ],
  [
    "missing node path",
    (data) => {
      data.vulnerabilities["synthetic-0"].nodes = [];
    },
  ],
  [
    "missing advisory",
    (data) => {
      data.vulnerabilities["synthetic-0"].via = [];
    },
  ],
  [
    "invalid advisory",
    (data) => {
      data.vulnerabilities["synthetic-0"].via = [{}];
    },
  ],
  [
    "missing package",
    (data) => {
      data.vulnerabilities = {};
    },
  ],
]) {
  test(`rejects ${name} instead of publishing an unreliable count`, () => {
    const data = report(["high"]);
    mutate(data);
    assert.equal(inspectAudit(response(data, { status: 1 })).state, "unavailable");
  });
}
test("rejects known high findings with an inconsistent zero exit", () => {
  assert.equal(
    inspectAudit(response(report(["high"]), { status: 0 })).reason,
    "inconsistent_exit_status",
  );
});
test("full audit explicitly includes dev, optional and peer dependencies", () => {
  const args = auditArguments("all");
  assert.ok(args.includes("--include=dev"));
  assert.ok(args.includes("--include=optional"));
  assert.ok(args.includes("--include=peer"));
  assert.ok(args.includes("--audit-level=moderate"));
  assert.ok(!args.includes("fix"));
  assert.ok(auditArguments("production").includes("--omit=dev"));
  assert.throws(() => auditArguments("unknown"));
});
test("an absent audit cannot pass the combined policy", () => {
  assert.equal(summarizeAudits([]).passed, false);
  assert.equal(
    summarizeAudits([{ scope: "production", ...inspectAudit(response(report())) }]).passed,
    false,
  );
});

for (const [name, production, all, passed] of [
  ["clean pair", response(report()), response(report()), true],
  ["full findings retained", response(report()), response(report(["high", "critical"])), true],
  [
    "production moderate blocked",
    response(report(["moderate"])),
    response(report(["moderate"])),
    false,
  ],
  [
    "existing low-severity policy retained",
    response(report(["low"])),
    response(report(["low"])),
    true,
  ],
  [
    "production failure still audits full tree",
    response(report(), { status: 2 }),
    response(report(["high"])),
    false,
  ],
  [
    "full network failure blocks",
    response(report()),
    response(report(), { errorCode: "ETIMEDOUT" }),
    false,
  ],
  ["full malformed report blocks", response(report()), response(report(), { stdout: "{}" }), false],
]) {
  test(`${name}: both scopes run and raw evidence survives`, async () => {
    const outputDirectory = await mkdtemp(path.join(tmpdir(), "gyms-audits-"));
    try {
      const calls = [];
      const summary = await runAudits({
        outputDirectory,
        execute: (scope) => {
          calls.push(scope);
          return scope === "production" ? production : all;
        },
      });
      assert.deepEqual(calls, ["production", "all"]);
      assert.equal(summary.passed, passed);
      assert.equal(
        await readFile(path.join(outputDirectory, "audit-all.json"), "utf8"),
        all.stdout,
      );
      assert.equal(
        await readFile(path.join(outputDirectory, "audit-production.json"), "utf8"),
        production.stdout,
      );
      assert.deepEqual(
        JSON.parse(await readFile(path.join(outputDirectory, "audit-status.json"), "utf8")),
        summary,
      );
    } finally {
      await rm(outputDirectory, { recursive: true, force: true });
    }
  });
}
test("thrown executor errors do not skip the other audit or preserve stale green evidence", async () => {
  const outputDirectory = await mkdtemp(path.join(tmpdir(), "gyms-audit-stale-"));
  try {
    await writeFile(path.join(outputDirectory, "audit-status.json"), '{"passed":true}');
    await writeFile(path.join(outputDirectory, "audit-production.json"), JSON.stringify(report()));
    const calls = [];
    const result = await runAudits({
      outputDirectory,
      execute: (scope) => {
        calls.push(scope);
        if (scope === "production") throw new Error("private registry credential must not appear");
        return response(report());
      },
    });
    assert.deepEqual(calls, ["production", "all"]);
    assert.equal(result.passed, false);
    assert.equal(await readFile(path.join(outputDirectory, "audit-production.json"), "utf8"), "");
    assert.ok(!JSON.stringify(result).includes("private registry"));
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
});
test("untrusted advisory text is not interpreted as GitHub workflow commands", () => {
  const data = report(["high"]);
  data.vulnerabilities["synthetic-0"].via[0].title = "\n::error::fabricated command";
  const summary = summarizeAudits([
    { scope: "production", ...inspectAudit(response(report())) },
    { scope: "all", ...inspectAudit(response(data)) },
  ]);
  const text = formatAuditSummary(summary);
  assert.ok(text.includes("FINDINGS RECORDED"));
  assert.ok(!text.includes("fabricated"));
});

for (const [name, data, status, expected] of [
  ["recorded high findings", report(["high"]), 1, 0],
  ["unavailable registry", { error: { code: "E503" } }, 1, 1],
]) {
  test(`actual CLI exit and receipt: ${name}`, { skip: process.platform === "win32" }, async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "gyms-audit-cli-"));
    try {
      const bin = path.join(directory, "bin");
      await mkdir(bin);
      const npm = path.join(bin, "npm");
      // Local fake executable exercises the CLI without making registry requests.
      await writeFile(
        npm,
        `#!${process.execPath}\nconst all=process.argv.includes('--include=dev');\nconsole.log(JSON.stringify(all ? ${JSON.stringify(data)} : ${JSON.stringify(report())}));process.exitCode=all?${status}:0;\n`,
      );
      await chmod(npm, 0o700);
      const script = fileURLToPath(new URL("./dependency-audits.mjs", import.meta.url));
      const result = spawnSync(process.execPath, [script], {
        cwd: directory,
        encoding: "utf8",
        timeout: 10000,
        env: { PATH: bin, GITHUB_STEP_SUMMARY: path.join(directory, "summary.md") },
      });
      assert.equal(result.status, expected, result.stderr);
      const summary = JSON.parse(
        await readFile(
          path.join(directory, "test-results/dependency-security/audit-status.json"),
          "utf8",
        ),
      );
      assert.equal(summary.passed, expected === 0);
      assert.ok(
        (await readFile(path.join(directory, "summary.md"), "utf8")).includes(
          "Dependency audit verification",
        ),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}
