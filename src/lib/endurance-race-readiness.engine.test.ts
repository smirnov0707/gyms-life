import { describe, expect, it } from "vitest";
import { assessRaceReadiness } from "./endurance-race-readiness.engine";
describe("race readiness", () => {
  it("refuses a readiness label with too little evidence", () => {
    expect(assessRaceReadiness({ weeksObserved: 1, sessionCompletionRate: 1, distanceCompletionRate: 1, longestRunProgressRate: null, recentLowResponseStreak: 0, latestReadinessBand: "high", repeatedOverTargetRuns: 0 }).status).toBe("insufficient_evidence");
  });
  it("calls consistent preparation on track without inventing a probability", () => {
    expect(assessRaceReadiness({ weeksObserved: 4, sessionCompletionRate: .85, distanceCompletionRate: .9, longestRunProgressRate: .8, recentLowResponseStreak: 0, latestReadinessBand: "moderate", repeatedOverTargetRuns: 0 })).toEqual({ status: "on_track", factors: ["consistent_plan_adherence"], evidenceLevel: "high" });
  });
  it("surfaces strain from repeated response and low readiness", () => {
    expect(assessRaceReadiness({ weeksObserved: 4, sessionCompletionRate: .8, distanceCompletionRate: .8, longestRunProgressRate: .7, recentLowResponseStreak: 3, latestReadinessBand: "low", repeatedOverTargetRuns: 0 }).status).toBe("strained");
  });
});
