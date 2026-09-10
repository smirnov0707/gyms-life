import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(`${root}/${path}`, "utf8");

describe("Today and training-plan UX contract", () => {
  it("keeps the Today decision from duplicating the primary workout CTA", () => {
    const overview = read("src/components/Overview.tsx");
    const decision = read("src/components/TodayDecision.tsx");
    expect(overview).toContain("primaryTrainingActionHandled={Boolean(today)}");
    expect(decision).toContain("primaryTrainingActionHandled &&");
    expect(decision).toContain('decision.action === "train_as_planned"');
    expect(decision).toContain('decision.action === "train_adapted"');
  });

  it("does not hard-code an eight-week plan in the generation contract", () => {
    const generator = read("src/lib/plan.functions.ts");
    expect(generator).toContain('"weeks": ${data.planWeeks}');
    expect(generator).not.toContain('"weeks": 8');
    expect(generator).not.toContain("8 Savaičių Progresyvi Programa");
  });
  it("keeps legacy recovery dismissible without hiding real sync failures", () => {
    const offline = read("src/components/OfflineQueueSync.tsx");
    expect(offline).toContain("gymslife:legacy-banner-dismissed");
    expect(offline).toContain("legacyDismissed");
    expect(offline).toContain("count > 0 || unavailable");
  });

  it("keeps plan creation and management discoverable", () => {
    const panel = read("src/components/TodaysPlanPanel.tsx");
    const active = read("src/components/ActivePlanLoader.tsx");
    expect(panel).toContain('to="/training"');
    expect(active).toContain('to="/onboarding"');
    expect(active).toContain("deactivateActivePlan");
  });
});
