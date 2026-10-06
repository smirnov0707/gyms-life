import { describe, expect, it } from "vitest";
import { evaluatePlannedRun, summarizeRaceWeek } from "./endurance-race-progress.engine";

const planned = (distance: number, sessionKey: string) => ({
  sessionKey,
  intent: "easy" as const,
  plannedDurationMinutes: null,
  plannedDistanceMeters: distance,
  intensityCue: "Easy",
});

describe("race progress", () => {
  it("treats small distance variance as completed rather than failure", () => {
    expect(
      evaluatePlannedRun(planned(10_000, "w1-s1"), {
        distanceMeters: 9_300,
        durationMinutes: 55,
        perceivedEffort: 5,
      }).status,
    ).toBe("completed");
  });

  it("labels meaningful under and over target evidence", () => {
    expect(
      evaluatePlannedRun(planned(10_000, "w1-s1"), {
        distanceMeters: 7_000,
        durationMinutes: 45,
        perceivedEffort: 6,
      }).status,
    ).toBe("under_target");
    expect(
      evaluatePlannedRun(planned(10_000, "w1-s1"), {
        distanceMeters: 12_000,
        durationMinutes: 65,
        perceivedEffort: 7,
      }).status,
    ).toBe("over_target");
  });

  it("keeps free runs out of race-plan adherence", () => {
    const result = summarizeRaceWeek({
      planned: [
        planned(5_000, "w1-s1"),
        planned(8_000, "w1-s2"),
        planned(12_000, "w1-s3"),
      ],
      completed: [
        { planSessionKey: "w1-s1", distanceMeters: 5_000, durationMinutes: 30, perceivedEffort: null },
        { planSessionKey: "w1-s2", distanceMeters: 10_000, durationMinutes: 60, perceivedEffort: null },
        { planSessionKey: null, distanceMeters: 6_000, durationMinutes: 35, perceivedEffort: null },
      ],
    });

    expect(result.completedSessions).toBe(2);
    expect(result.plannedSessions).toBe(3);
    expect(result.observedRuns).toBe(3);
    expect(result.completedDistanceMeters).toBe(15_000);
    expect(result.observedDistanceMeters).toBe(21_000);
    expect(result.distanceCompletionRatio).toBe(0.6);
  });
});
