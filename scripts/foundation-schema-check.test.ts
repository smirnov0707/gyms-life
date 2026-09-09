import { describe, expect, it } from "vitest";
import { evaluateFoundationSchema } from "./foundation-schema-check.mjs";
function compatible() {
  const migrations: Array<{ version: string; name: string }> = [];
  const fn = {
    present: true,
    security_definer: false,
    result: "uuid",
    definition_md5: "0".repeat(32),
    authenticated_execute: true,
    anonymous_execute: false,
  };
  const policy = (table: string) => ({
    present: true,
    table,
    restrictive: true,
    command: "ALL",
    roles: ["authenticated"],
    using: "owner check",
    check: "parent owner check",
  });
  return {
    schema: "gyms-foundation-preflight.v1",
    captured_at: "2026-09-09T00:00:00Z",
    functions: {
      activate_training_plan: { ...fn },
      activate_meal_plan: { ...fn },
      commit_generated_meal_plan: {
        ...fn,
        result:
          "TABLE(plan_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone)",
      },
    },
    parent_policies: {
      workout_sessions_parent_ownership: policy("workout_sessions"),
      set_logs_parent_ownership: policy("set_logs"),
    },
    rls: { profiles: true, plans: true, meal_plans: true, workout_sessions: true, set_logs: true },
    recent_migrations: migrations,
  };
}
describe("core schema deployment prerequisites", () => {
  it("labels a compatible schema as a limited gate, never a ready-to-publish product", () => {
    const result = evaluateFoundationSchema(compatible());
    expect(result.status).toBe("compatible");
    expect(result.scope).toBe("core_schema_only");
    expect(result).not.toHaveProperty("readyToPublish");
  });
  it.each([null, {}, { schema: "v0" }])("fails closed for incomplete reports %j", (input) =>
    expect(evaluateFoundationSchema(input).status).toBe("blocked"),
  );
  it("reproduces the production blockers without deleting or migrating anything", () => {
    const report = compatible();
    report.functions.commit_generated_meal_plan.present = false;
    report.parent_policies.workout_sessions_parent_ownership.present = false;
    report.parent_policies.set_logs_parent_ownership.present = false;
    expect(evaluateFoundationSchema(report).blockers).toEqual([
      "missing_function:commit_generated_meal_plan",
      "missing_parent_policy:workout_sessions_parent_ownership",
      "missing_parent_policy:set_logs_parent_ownership",
    ]);
  });
  it.each(["profiles", "plans", "meal_plans", "workout_sessions", "set_logs"] as const)(
    "requires RLS on %s",
    (table) => {
      const report = compatible();
      report.rls[table] = false;
      expect(evaluateFoundationSchema(report).blockers).toContain(`rls_not_enabled:${table}`);
    },
  );
  it("rejects anonymous access and definer privilege changes", () => {
    const report = compatible();
    report.functions.commit_generated_meal_plan.anonymous_execute = true;
    report.functions.activate_training_plan.security_definer = true;
    expect(evaluateFoundationSchema(report).blockers).toEqual([
      "unexpected_definer:activate_training_plan",
      "unsafe_execute_grants:commit_generated_meal_plan",
    ]);
  });
  it("does not mistake a permissive/empty parent policy for the restrictive contract", () => {
    const report = compatible();
    report.parent_policies.workout_sessions_parent_ownership.restrictive = false;
    report.parent_policies.set_logs_parent_ownership.check = "";
    expect(evaluateFoundationSchema(report).blockers).toHaveLength(2);
  });
  it("detects a wrong routine overload result", () => {
    const report = compatible();
    report.functions.commit_generated_meal_plan.result = "void";
    expect(evaluateFoundationSchema(report).blockers).toContain(
      "wrong_return_contract:commit_generated_meal_plan",
    );
  });
  it("migration names or timestamps alone cannot make missing functionality pass", () => {
    const report = compatible();
    report.functions.commit_generated_meal_plan.present = false;
    report.recent_migrations = [
      { version: "20260909104041", name: "fix_meal_commit_variable_names" },
    ];
    expect(evaluateFoundationSchema(report).status).toBe("blocked");
  });
});
