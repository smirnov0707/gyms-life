import { describe, expect, it } from "vitest";
import { evaluatePersonalExperiment } from "./personal-experiment-evaluation";

describe("personal experiment evaluation", () => {
  it("withholds interpretation below the observation floor", () => {
    expect(
      evaluatePersonalExperiment({
        baselineObservations: 2,
        interventionObservations: 3,
        repeatedCycleCount: 2,
        directionallyConsistent: true,
      }),
    ).toMatchObject({
      result: "insufficient",
      causalClaimAllowed: false,
      decisionAuthority: false,
    });
  });

  it("calls a repeated directional pattern an association, never causation", () => {
    expect(
      evaluatePersonalExperiment({
        baselineObservations: 6,
        interventionObservations: 6,
        repeatedCycleCount: 2,
        directionallyConsistent: true,
      }),
    ).toEqual({
      baselineObservations: 6,
      interventionObservations: 6,
      repeatedCycleCount: 2,
      directionallyConsistent: true,
      result: "association_observed",
      causalClaimAllowed: false,
      decisionAuthority: false,
      requiresReplication: true,
    });
  });

  it("keeps inconsistent evidence as no clear signal", () => {
    expect(
      evaluatePersonalExperiment({
        baselineObservations: 8,
        interventionObservations: 8,
        repeatedCycleCount: 3,
        directionallyConsistent: false,
      }).result,
    ).toBe("no_clear_signal");
  });
});
