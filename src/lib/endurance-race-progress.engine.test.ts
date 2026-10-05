import { describe, expect, it } from "vitest";
import { evaluatePlannedRun, summarizeRaceWeek } from "./endurance-race-progress.engine";

const planned = (distance: number) => ({ intent: "easy" as const, plannedDurationMinutes: null, plannedDistanceMeters: distance, intensityCue: "Easy" });

describe("race progress", () => {
  it("treats small distance variance as completed rather than failure", () => {
    expect(evaluatePlannedRun(planned(10000), { distanceMeters: 9300, durationMinutes: 55, perceivedEffort: 5 }).status).toBe("completed");
  });
  it("labels meaningful under and over target evidence", () => {
    expect(evaluatePlannedRun(planned(10000), { distanceMeters: 7000, durationMinutes: 45, perceivedEffort: 6 }).status).toBe("under_target");
    expect(evaluatePlannedRun(planned(10000), { distanceMeters: 12000, durationMinutes: 65, perceivedEffort: 7 }).status).toBe("over_target");
  });
  it("summarizes weekly adherence without inventing matches", () => {
    const result = summarizeRaceWeek({ planned: [planned(5000), planned(8000), planned(12000)], completed: [{ distanceMeters: 5000, durationMinutes: 30, perceivedEffort: null }, { distanceMeters: 10000, durationMinutes: 60, perceivedEffort: null }] });
    expect(result.completedSessions).toBe(2);
    expect(result.plannedSessions).toBe(3);
    expect(result.distanceCompletionRatio).toBe(0.6);
  });
});
