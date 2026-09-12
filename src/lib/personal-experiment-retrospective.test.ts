import { describe, expect, it } from "vitest";
import { buildPersonalExperimentRetrospective } from "./personal-experiment-retrospective";

const outcome = (phase: "baseline" | "intervention" | "followup", value: number) => ({
  phase,
  outcome_key: "readiness",
  numeric_value: value,
});

describe("personal experiment retrospective", () => {
  it("withholds interpretation below the observation floor", () => {
    const result = buildPersonalExperimentRetrospective({
      primaryOutcome: "readiness",
      outcomes: [outcome("baseline", 60), outcome("baseline", 62), outcome("intervention", 68)],
    });
    expect(result).toMatchObject({ evidence: "insufficient", direction: "unknown" });
    expect(result.causalClaimAllowed).toBe(false);
    expect(result.decisionAuthority).toBe(false);
  });
  it("reports a directional association without causal authority", () => {
    const result = buildPersonalExperimentRetrospective({
      primaryOutcome: "readiness",
      outcomes: [
        outcome("baseline", 60),
        outcome("baseline", 61),
        outcome("baseline", 59),
        outcome("intervention", 68),
        outcome("intervention", 69),
        outcome("intervention", 67),
        outcome("followup", 64),
      ],
    });
    expect(result.evidence).toBe("association_observed");
    expect(result.direction).toBe("higher");
    expect(result.absoluteDelta).toBeCloseTo(8);
    expect(result.relativeDeltaPct).toBeCloseTo(13.3333, 3);
    expect(result.followupCount).toBe(1);
  });

  it("keeps effectively flat changes uncertain", () => {
    const result = buildPersonalExperimentRetrospective({
      primaryOutcome: "readiness",
      outcomes: [
        outcome("baseline", 100),
        outcome("baseline", 100),
        outcome("baseline", 100),
        outcome("intervention", 100.5),
        outcome("intervention", 100),
        outcome("intervention", 100),
      ],
    });
    expect(result).toMatchObject({ evidence: "uncertain", direction: "flat" });
  });
});
