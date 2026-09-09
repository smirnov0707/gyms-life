import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
const FunctionSchema = z.object({
  present: z.boolean(),
  security_definer: z.boolean().nullable(),
  result: z.string().nullable(),
  definition_md5: z
    .string()
    .regex(/^[a-f0-9]{32}$/)
    .nullable(),
  authenticated_execute: z.boolean(),
  anonymous_execute: z.boolean(),
});
const PolicySchema = z.object({
  present: z.boolean(),
  table: z.string(),
  restrictive: z.boolean(),
  command: z.string().nullable(),
  roles: z.array(z.string()).nullable(),
  using: z.string().nullable(),
  check: z.string().nullable(),
});
const functions = ["activate_training_plan", "activate_meal_plan", "commit_generated_meal_plan"];
const requiredTables = ["profiles", "plans", "meal_plans", "workout_sessions", "set_logs"];
const policies = {
  workout_sessions_parent_ownership: "workout_sessions",
  set_logs_parent_ownership: "set_logs",
};
export const FoundationProbeSchema = z.object({
  schema: z.literal("gyms-foundation-preflight.v1"),
  captured_at: z.string().datetime({ offset: true }),
  functions: z.record(z.string(), FunctionSchema),
  parent_policies: z.record(z.string(), PolicySchema),
  rls: z.record(z.string(), z.boolean()),
  recent_migrations: z.array(z.object({ version: z.string().regex(/^\d{14}$/), name: z.string() })),
});
/** A necessary schema gate only; this never certifies live AI, auth or offline behaviour. */
export function evaluateFoundationSchema(input) {
  const parsed = FoundationProbeSchema.safeParse(input);
  if (!parsed.success)
    return { status: "blocked", blockers: ["invalid_preflight_report"], scope: "core_schema_only" };
  const report = parsed.data,
    blockers = [];
  for (const name of functions) {
    const fn = report.functions[name];
    if (!fn?.present) {
      blockers.push(`missing_function:${name}`);
      continue;
    }
    if (fn.security_definer !== false) blockers.push(`unexpected_definer:${name}`);
    if (!fn.authenticated_execute || fn.anonymous_execute)
      blockers.push(`unsafe_execute_grants:${name}`);
    const expected =
      name === "commit_generated_meal_plan"
        ? "TABLE(plan_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone)"
        : "uuid";
    if (fn.result !== expected) blockers.push(`wrong_return_contract:${name}`);
  }
  for (const table of requiredTables)
    if (report.rls[table] !== true) blockers.push(`rls_not_enabled:${table}`);
  for (const [name, table] of Object.entries(policies)) {
    const policy = report.parent_policies[name];
    if (!policy?.present) {
      blockers.push(`missing_parent_policy:${name}`);
      continue;
    }
    if (
      policy.table !== table ||
      !policy.restrictive ||
      policy.command !== "ALL" ||
      !policy.roles?.includes("authenticated") ||
      !policy.using?.trim() ||
      !policy.check?.trim()
    )
      blockers.push(`invalid_parent_policy:${name}`);
  }
  return {
    status: blockers.length ? "blocked" : "compatible",
    blockers,
    scope: "core_schema_only",
    capturedAt: report.captured_at,
    caution:
      "Presence, signatures and grants are necessary but do not prove policy semantics or release readiness. Review definitions and run rolled-back owner/isolation tests before rollout.",
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) {
    console.error("Usage: node scripts/foundation-schema-check.mjs READ_ONLY_PROBE.json");
    process.exitCode = 2;
  } else {
    try {
      const result = evaluateFoundationSchema(JSON.parse(readFileSync(process.argv[2], "utf8")));
      console.log(JSON.stringify(result, null, 2));
      if (result.status !== "compatible") process.exitCode = 1;
    } catch {
      console.error("Could not read a valid preflight JSON report");
      process.exitCode = 2;
    }
  }
}
