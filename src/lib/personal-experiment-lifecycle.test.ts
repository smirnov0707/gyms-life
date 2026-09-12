import { describe, expect, it } from "vitest";
import { nextPersonalExperimentState } from "./personal-experiment-lifecycle";
import type { PersonalExperimentGovernance } from "./personal-experiment-governance";

const allowed: PersonalExperimentGovernance = {
  risk: "low",
  eligibleToRun: true,
  decisionAuthority: false,
  causalClaimAllowed: false,
  automaticPlanChangeAllowed: false,
  blockers: [],
};

const blocked: PersonalExperimentGovernance = {
  ...allowed,
  risk: "blocked",
  eligibleToRun: false,
  blockers: ["medication_change_not_allowed"],
};

describe("personal experiment lifecycle", () => {
  it("requires governance eligibility before start", () => {
    expect(
      nextPersonalExperimentState({ state: "draft", event: "mark_eligible", governance: blocked }),
    ).toBe("draft");
    expect(
      nextPersonalExperimentState({ state: "draft", event: "mark_eligible", governance: allowed }),
    ).toBe("eligible");
    expect(
      nextPersonalExperimentState({ state: "eligible", event: "start", governance: allowed }),
    ).toBe("running");
  });

  it("stops immediately on adverse signal", () => {
    expect(
      nextPersonalExperimentState({
        state: "running",
        event: "adverse_signal",
        governance: allowed,
      }),
    ).toBe("stopped");
  });

  it("does not restart terminal experiments implicitly", () => {
    expect(
      nextPersonalExperimentState({ state: "completed", event: "start", governance: allowed }),
    ).toBe("completed");
    expect(
      nextPersonalExperimentState({ state: "stopped", event: "start", governance: allowed }),
    ).toBe("stopped");
  });
});
