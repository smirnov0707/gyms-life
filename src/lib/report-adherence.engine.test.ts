import { describe, expect, it } from "vitest";
import {
  ADHERENCE_HIGH_FROM,
  calculateReportAdherence,
  REPORT_WINDOW_DAYS,
} from "./report-adherence.engine";

const base = {
  sessionsPerWeek: 4,
  plannedSessionsPerWeek: 4,
  checkins: 30,
  nutritionDaysLogged: 30,
};

describe("calculateReportAdherence", () => {
  it("averages the share of what was possible in each component", () => {
    // Trained as planned, checked in 15 of 30 days, logged food 6 of 30.
    const result = calculateReportAdherence({ ...base, checkins: 15, nutritionDaysLogged: 6 });
    expect(result.measured.map((c) => c.percent)).toEqual([100, 50, 20]);
    expect(result.score).toBe(57);
    expect(result.band).toBe("moderate");
  });

  it("treats beating the plan as full marks rather than a bonus", () => {
    // Six sessions a week against a target of three is not 200% adherent.
    const result = calculateReportAdherence({
      ...base,
      sessionsPerWeek: 6,
      plannedSessionsPerWeek: 3,
    });
    expect(result.measured[0]?.percent).toBe(100);
    expect(result.score).toBe(100);
    expect(result.band).toBe("high");
  });

  it("names a component it cannot judge instead of scoring it zero", () => {
    // An athlete who never stated how often they intend to train has not
    // failed to train that often. Scoring the gap as 0 would have dragged a
    // perfect month down to 67 on a document a doctor reads.
    const result = calculateReportAdherence({ ...base, plannedSessionsPerWeek: null });
    expect(result.unmeasured).toEqual(["training"]);
    expect(result.measured.map((c) => c.key)).toEqual(["checkins", "nutrition"]);
    expect(result.score).toBe(100);
  });

  it("shows the two numbers behind every component", () => {
    const result = calculateReportAdherence({ ...base, checkins: 21 });
    const checkins = result.measured.find((c) => c.key === "checkins");
    expect(checkins).toMatchObject({ actual: 21, possible: REPORT_WINDOW_DAYS, percent: 70 });
  });

  it("bands on the thresholds the report's badge already coloured by", () => {
    const high = calculateReportAdherence({
      ...base,
      checkins: 21,
      nutritionDaysLogged: 21,
      sessionsPerWeek: 4,
    });
    expect(high.score).toBeGreaterThanOrEqual(ADHERENCE_HIGH_FROM);
    expect(high.band).toBe("high");

    const low = calculateReportAdherence({ ...base, checkins: 3, nutritionDaysLogged: 0 });
    expect(low.band).toBe("low");
  });
});
