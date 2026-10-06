import { describe, expect, it } from "vitest";
import { assessRaceReadiness } from "./endurance-race-readiness.engine";

describe("race readiness", () => {
  it("refuses a readiness label with too little evidence", () => {
    expect(
      assessRaceReadiness({
        weeksObserved: 1,
        sessionCompletionRate: 1,
        distanceCompletionRate: 1,
        longRunTrend: null,
        recentLowResponseStreak: 0,
        latestReadinessBand: "high",
        repeatedOverTargetRuns: 0,
      }).status,
    ).toBe("insufficient_evidence");
  });

  it("calls consistent preparation on track without inventing a probability", () => {
    expect(
      assessRaceReadiness({
        weeksObserved: 4,
        sessionCompletionRate: 0.85,
        distanceCompletionRate: 0.9,
        longRunTrend: "stable",
        recentLowResponseStreak: 0,
        latestReadinessBand: "moderate",
        repeatedOverTargetRuns: 0,
      }),
    ).toEqual({
      status: "on_track",
      factors: ["consistent_plan_adherence"],
      evidenceLevel: "high",
    });
  });

  it("uses long-run direction rather than a universal race-distance percentage", () => {
    expect(
      assessRaceReadiness({
        weeksObserved: 4,
        sessionCompletionRate: 0.85,
        distanceCompletionRate: 0.9,
        longRunTrend: "progressing",
        recentLowResponseStreak: 0,
        latestReadinessBand: "moderate",
        repeatedOverTargetRuns: 0,
      }).factors,
    ).toContain("consistent_plan_adherence_with_long_run_progress");
  });

  it("surfaces strain from repeated response and low readiness", () => {
    expect(
      assessRaceReadiness({
        weeksObserved: 4,
        sessionCompletionRate: 0.8,
        distanceCompletionRate: 0.8,
        longRunTrend: "stable",
        recentLowResponseStreak: 3,
        latestReadinessBand: "low",
        repeatedOverTargetRuns: 0,
      }).status,
    ).toBe("strained");
  });
});
