import { describe, expect, it } from "vitest";
import { buildRaceCoachBrief } from "./endurance-race-coach.engine";

describe("race coach brief", () => {
  it("keeps motivational AI inside deterministic evidence", () => {
    const brief = buildRaceCoachBrief({
      progress: {
        plannedSessions: 4,
        completedSessions: 3,
        matchedSessions: 3,
        observedRuns: 4,
        plannedDistanceMeters: 30000,
        completedDistanceMeters: 24000,
        observedDistanceMeters: 29000,
        distanceCompletionRatio: 0.8,
      },
      adaptation: { action: "hold", volumeModifier: 1, reason: "on_track" },
    });
    expect(brief.allowedMessageIntent).toBe("motivate");
    expect(brief.prohibitedClaims).toContain("guaranteed_race_time");
  });
});
