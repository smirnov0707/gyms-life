import { describe, expect, it } from "vitest";
import { RaceGoalSchema } from "./endurance-race-goal.schema";
import { buildRacePlan } from "./endurance-race-plan.engine";

describe("race plan engine", () => {
  it("builds a measured half-marathon plan without >8% build jumps", () => {
    const goal = RaceGoalSchema.parse({ distance: "half_marathon", raceDate: "2027-02-14", sessionsPerWeek: 4 });
    const plan = buildRacePlan({ today: "2026-10-06", goal, baseline: { recentWeeklyDistanceMeters: 30000, recentLongestRunMeters: 14000 } });
    expect(plan.baseline).toBe("measured");
    expect(plan.weeksPlan.at(-1)?.sessions[0]?.intent).toBe("race");
    const buildWeeks = plan.weeksPlan.filter((w) => w.phase === "build" || w.phase === "specific");
    for (let i = 1; i < buildWeeks.length; i++) expect(buildWeeks[i]!.targetDistanceMeters).toBeLessThanOrEqual(Math.round(buildWeeks[i-1]!.targetDistanceMeters * 1.081));
  });

  it("uses a conservative default when history is absent", () => {
    const goal = RaceGoalSchema.parse({ distance: "5k", raceDate: "2026-12-06", sessionsPerWeek: 3 });
    expect(buildRacePlan({ today: "2026-10-06", goal, baseline: { recentWeeklyDistanceMeters: null, recentLongestRunMeters: null } }).baseline).toBe("conservative_default");
  });

  it("refuses a last-minute generated race plan", () => {
    const goal = RaceGoalSchema.parse({ distance: "marathon", raceDate: "2026-11-20", sessionsPerWeek: 4 });
    expect(() => buildRacePlan({ today: "2026-10-06", goal, baseline: { recentWeeklyDistanceMeters: 30000, recentLongestRunMeters: 15000 } })).toThrow(/56 days/);
  });

  it("allows a shorter runway for 5k than marathon", () => {
    const goal = RaceGoalSchema.parse({ distance: "5k", raceDate: "2026-10-20", sessionsPerWeek: 3 });
    expect(buildRacePlan({ today: "2026-10-06", goal, baseline: { recentWeeklyDistanceMeters: 12000, recentLongestRunMeters: 5000 } }).weeks).toBe(2);
  });
});
