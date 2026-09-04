import { describe, expect, it } from "vitest";
import type { DigitalAthleteState } from "./digital-athlete.schema";
import { mapDigitalAthleteStateToTwinSnapshot } from "./digital-twin.mapper";
import { KNOWN_MUSCLE_GROUPS } from "./muscle-load.schema";

const baseState: DigitalAthleteState = {
  schemaVersion: "1.7",
  training: {
    sessionsLast7Days: 0,
    sessionsLast28Days: 0,
    totalVolumeLast28Days: 0,
    daysSinceLastCompletedWorkout: null,
    selfReportedResponse: {
      source: "user_reported",
      available: false,
      ratedSessionsLast28Days: 0,
      latestFeeling: null,
      averageFeelingLast28Days: null,
      recentLowFeelingStreak: 0,
    },
  },
  recovery: {
    checkinsLast7Days: 0,
    latestReadinessScore: null,
    averageReadinessLast7Days: null,
    averageSleepHoursLast7Days: null,
  },
  body: {
    measurementsLast30Days: 0,
    latestWeightKg: null,
    latestBodyFatPercent: null,
    weightChangeKgLast30Days: null,
  },
  nutrition: {
    loggedDaysLast14Days: 0,
    averageCaloriesOnLoggedDays: null,
    averageProteinGOnLoggedDays: null,
  },
  currentDay: {
    day: "2026-09-04",
    weekday: 5,
    hasCompletedReadiness: false,
    hasCompletedWorkout: false,
    hasLoggedNutrition: false,
  },
  behavior: {
    status: "not_configured",
    preferredWeekdays: [],
    usualTrainingDaysLast28Days: null,
    completedUsualTrainingDaysLast28Days: null,
    completedFlexibleTrainingDaysLast28Days: null,
    usualDayCompletionRateLast28Days: null,
  },
  decisionFeedback: {
    available: false,
    ratedDecisionsLast28Days: 0,
    helpfulDecisionOutcomesLast28Days: 0,
    notHelpfulDecisionOutcomesLast28Days: 0,
    helpfulnessRate: null,
  },
  currentContext: {
    active: [],
    shortestAvailableSessionMinutes: null,
    hasTrainingConstraint: false,
    hasSafetyConstraint: false,
  },
  dataQuality: { level: "cold_start", evidenceCount: 0, availableDomains: [] },
  dataGaps: [],
  muscleLoad: [],
};

describe("mapDigitalAthleteStateToTwinSnapshot", () => {
  const now = new Date("2026-09-04T12:00:00.000Z");

  it("represents every known region as unknown when there is no muscle load evidence", () => {
    const snapshot = mapDigitalAthleteStateToTwinSnapshot(baseState, now);

    expect(snapshot.dataAvailable).toBe(true);
    expect(snapshot.regions).toHaveLength(KNOWN_MUSCLE_GROUPS.length);
    for (const region of snapshot.regions) {
      expect(region.provenance).toBe("unknown");
      expect(region.recoveryPct).toBeNull();
      expect(region.recoveryBand).toBe("unknown");
    }
  });

  it("uses the calculated region for a group with evidence, and leaves the rest unknown", () => {
    const state: DigitalAthleteState = {
      ...baseState,
      muscleLoad: [
        { muscleGroup: "chest", volumeKg: 500, recoveryPct: 40, lastTrainedHoursAgo: 3 },
      ],
    };

    const snapshot = mapDigitalAthleteStateToTwinSnapshot(state, now);
    const chest = snapshot.regions.find((region) => region.region === "chest");
    const legs = snapshot.regions.find((region) => region.region === "legs");

    expect(chest).toEqual({
      region: "chest",
      provenance: "calculated",
      recoveryPct: 40,
      recoveryBand: "fatigued",
      volumeKg: 500,
      lastTrainedHoursAgo: 3,
    });
    expect(legs?.provenance).toBe("unknown");
    expect(snapshot.regions).toHaveLength(KNOWN_MUSCLE_GROUPS.length);
  });

  it("never drops a calculated region whose group is outside the known reference list", () => {
    const state: DigitalAthleteState = {
      ...baseState,
      muscleLoad: [
        { muscleGroup: "forearms", volumeKg: 80, recoveryPct: 90, lastTrainedHoursAgo: 20 },
      ],
    };

    const snapshot = mapDigitalAthleteStateToTwinSnapshot(state, now);
    const forearms = snapshot.regions.find((region) => region.region === "forearms");

    expect(forearms?.provenance).toBe("calculated");
    expect(forearms?.recoveryBand).toBe("fresh");
    // The known 11 (all unknown here) plus the one real, unlisted region.
    expect(snapshot.regions).toHaveLength(KNOWN_MUSCLE_GROUPS.length + 1);
  });

  it("classifies bands at the shared thresholds", () => {
    const state: DigitalAthleteState = {
      ...baseState,
      muscleLoad: [
        { muscleGroup: "chest", volumeKg: 100, recoveryPct: 80, lastTrainedHoursAgo: 10 },
        { muscleGroup: "back", volumeKg: 100, recoveryPct: 55, lastTrainedHoursAgo: 10 },
        { muscleGroup: "legs", volumeKg: 100, recoveryPct: 54, lastTrainedHoursAgo: 10 },
      ],
    };

    const snapshot = mapDigitalAthleteStateToTwinSnapshot(state, now);
    const bandFor = (region: string) =>
      snapshot.regions.find((r) => r.region === region)?.recoveryBand;

    expect(bandFor("chest")).toBe("fresh");
    expect(bandFor("back")).toBe("moderate");
    expect(bandFor("legs")).toBe("fatigued");
  });

  it("marks data unavailable when the muscle-load source itself failed, not merely empty", () => {
    const state: DigitalAthleteState = {
      ...baseState,
      dataGaps: ["muscle_load_data_unavailable"],
    };

    const snapshot = mapDigitalAthleteStateToTwinSnapshot(state, now);
    expect(snapshot.dataAvailable).toBe(false);
  });

  it("carries the calculation version and evidence window through, not a fabricated value", () => {
    const snapshot = mapDigitalAthleteStateToTwinSnapshot(baseState, now);
    expect(snapshot.calculationVersion).toBe("digital-athlete-v1");
    expect(snapshot.evidenceWindowDays).toBe(7);
    expect(snapshot.computedAt).toBe(now.toISOString());
  });
});
