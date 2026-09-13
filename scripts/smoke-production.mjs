import { runProductionSmoke } from "./production-smoke.checks.mjs";

try {
  const report = await runProductionSmoke({
    base: process.env.GYMSLIFE_SMOKE_BASE_URL ?? "https://gyms.life",
    timeoutMs: Number(process.env.GYMSLIFE_SMOKE_TIMEOUT_MS ?? 15000),
  });
  for (const result of report.results) {
    console.log(
      `${result.ok ? "PASS" : "FAIL"} ${result.name} status=${result.status ?? "unavailable"} reason=${result.reason}`,
    );
  }
  console.log(
    "Night Lab execution and result receipts are NOT verified by this unauthenticated smoke check.",
  );
  if (!report.ok) process.exitCode = 1;
} catch {
  console.error("FAIL production-smoke-invalid-configuration");
  process.exitCode = 1;
}
