import { runProductionSmoke } from "./production-smoke.checks.mjs";

try {
  const report = await runProductionSmoke({
    base: process.env.GYMSLIFE_SMOKE_BASE_URL ?? "https://gyms.life",
    timeoutMs: Number(process.env.GYMSLIFE_SMOKE_TIMEOUT_MS ?? 15000),
    // Set this to the SHA you released to turn "the site answers" into "the
    // site is running what I shipped". Unset, the run still reports what is
    // live, which is the question nobody could answer during the skipped
    // release.
    expectedCommit: process.env.GYMSLIFE_EXPECTED_COMMIT ?? null,
  });
  for (const result of report.results) {
    console.log(
      `${result.ok ? "PASS" : "FAIL"} ${result.name} status=${result.status ?? "unavailable"} reason=${result.reason}`,
    );
  }
  console.log(`live commit: ${report.liveCommit ?? "unreadable"}`);
  if (!report.commitVerified)
    console.log(
      "The deployed commit was reported, not verified. Set GYMSLIFE_EXPECTED_COMMIT to check it.",
    );
  console.log(
    "Night Lab execution and result receipts are NOT verified by this unauthenticated smoke check.",
  );
  if (!report.ok) process.exitCode = 1;
} catch {
  console.error("FAIL production-smoke-invalid-configuration");
  process.exitCode = 1;
}
