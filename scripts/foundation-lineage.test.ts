import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
const manifest = JSON.parse(readFileSync("docs/FOUNDATION_LINEAGE_20260909.json", "utf8"));
describe("integrated foundation source retention", () => {
  it("pins full source commit identities rather than ambiguous branch names", () => {
    for (const value of Object.values(manifest.sourceHeads))
      expect(value).toMatch(/^[a-f0-9]{40}$/);
  });
  it("retains the restrictive migration and both core browser engines", () => {
    expect(existsSync("supabase/migrations/20260909082851_workout_parent_ownership.sql")).toBe(
      true,
    );
    const workflow = readFileSync(".github/workflows/core-browser.yml", "utf8");
    expect(workflow).toContain("engine: [chromium, webkit]");
    expect(workflow.match(/scripts\/test-foundation-browser\.mjs/g)).toHaveLength(2);
  });
  it("keeps the two critical workout merge behaviours together", () => {
    const source = readFileSync("src/routes/_authenticated/workout/$day.tsx", "utf8");
    expect(
      source.match(/queueSetOnThisDevice\(input\);\s*return \{ queued: true, recorded: input \};/g),
    ).toHaveLength(2);
    expect(source).toContain("new AthleteFacingError(copy.mustBeNumber(label))");
  });
  it("keeps offline-capable writes outside Query's automatic pause queue", () => {
    const source = readFileSync("src/routes/_authenticated/workout/$day.tsx", "utf8");
    for (const name of ["startMutation", "logMutation", "finishMutation"]) {
      const section = source.slice(source.indexOf(`const ${name} = useMutation({`));
      const options = section.slice(0, section.indexOf("mutationFn:"));
      expect(options).toContain('networkMode: "always"');
      expect(options).toContain("retry: false");
    }
  });
  it("never labels known open gates as production acceptance", () => {
    expect(manifest.paymentsDeferred).toBe(true);
    expect(manifest.productionDeployed).toBe(false);
    expect(manifest.remainingReleaseGates).toContain("offline_account_isolation");
    expect(manifest.remainingReleaseGates).toContain("production_core_schema");
  });
});
