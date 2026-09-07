import { describe, expect, it } from "vitest";
import { buildEvidenceReport, evidenceLevelFor } from "./evidence-level.engine";

describe("evidenceLevelFor", () => {
  it("climbs only as resolved predictions accumulate", () => {
    // At a minimum of 8: under 8 insufficient, 8-15 early, 16-31 moderate,
    // 32 and above strong.
    expect(evidenceLevelFor(0, 8)).toBe("insufficient");
    expect(evidenceLevelFor(7, 8)).toBe("insufficient");
    expect(evidenceLevelFor(8, 8)).toBe("early");
    expect(evidenceLevelFor(15, 8)).toBe("early");
    expect(evidenceLevelFor(16, 8)).toBe("moderate");
    expect(evidenceLevelFor(31, 8)).toBe("moderate");
    expect(evidenceLevelFor(32, 8)).toBe("strong");
    expect(evidenceLevelFor(400, 8)).toBe("strong");
  });

  it("refuses a count that is not a count", () => {
    expect(evidenceLevelFor(Number.NaN, 8)).toBe("insufficient");
    expect(evidenceLevelFor(-5, 8)).toBe("insufficient");
  });
});

describe("buildEvidenceReport", () => {
  it("lists every target the system defines, not only the modelled ones", () => {
    // A panel showing only what has been predicted quietly implies the rest
    // are covered.
    const report = buildEvidenceReport({ counts: [], minimumEvaluated: 8 });
    expect(report.status === "counted" && report.targets.map((entry) => entry.target)).toEqual([
      "workout_completion",
      "exercise_performance",
      "readiness",
      "short_term_fatigue",
    ]);
  });

  it("keeps 'never predicted' apart from 'not enough has resolved'", () => {
    const report = buildEvidenceReport({
      counts: [{ target: "workout_completion", captured: 3, evaluated: 1, pending: 2 }],
      minimumEvaluated: 8,
    });
    const [completion, performance] = report.status === "counted" ? report.targets : [];
    expect(completion).toMatchObject({ modelled: true, level: "insufficient", evaluated: 1 });
    expect(performance).toMatchObject({ modelled: false, level: "insufficient", captured: 0 });
  });

  it("counts only resolved predictions, never the pending ones", () => {
    // A prediction with no observed outcome is the claim, not the test.
    const report = buildEvidenceReport({
      counts: [{ target: "readiness", captured: 40, evaluated: 4, pending: 36 }],
      minimumEvaluated: 8,
    });
    const readiness =
      report.status === "counted" && report.targets.find((e) => e.target === "readiness");
    expect(readiness && readiness.level).toBe("insufficient");
    expect(readiness && readiness.pending).toBe(36);
  });

  it("tells an unread ledger from one that holds no predictions", () => {
    expect(buildEvidenceReport({ counts: null })).toEqual({ status: "unreadable" });
    expect(buildEvidenceReport({ counts: [] }).status).toBe("counted");
  });
});
