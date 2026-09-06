import { describe, expect, it } from "vitest";
import type { DigitalAthleteState } from "./digital-athlete.schema";
import {
  buildTwinMetricTrend,
  buildTwinRegionTrend,
  buildTwinTrendHistory,
  TWIN_TREND_LIMIT,
} from "./twin-trend";

const baseState: DigitalAthleteState = {
  schemaVersion: "1.7",
  training: {
    sessionsLast7Days: 2,
    sessionsLast28Days: 7,
    totalVolumeLast28Days: 4200,
    daysSinceLastCompletedWorkout: 1,
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
    checkinsLast7Days: 4,
    latestReadinessScore: 72,
    averageReadinessLast7Days: 70,
    averageSleepHoursLast7Days: 7.2,
  },
  body: {
    measurementsLast30Days: 2,
    latestWeightKg: 81.4,
    latestBodyFatPercent: null,
    weightChangeKgLast30Days: -0.4,
  },
  nutrition: {
    loggedDaysLast14Days: 8,
    averageCaloriesOnLoggedDays: 2350,
    averageProteinGOnLoggedDays: 155,
  },
  currentDay: {
    day: "2026-09-06",
    weekday: 0,
    hasCompletedReadiness: true,
    hasCompletedWorkout: false,
    hasLoggedNutrition: true,
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
  dataQuality: {
    level: "informed",
    evidenceCount: 23,
    availableDomains: ["training", "recovery", "body", "nutrition"],
  },
  dataGaps: [],
  muscleLoad: [
    { muscleGroup: "chest", volumeKg: 520, recoveryPct: 64, lastTrainedHoursAgo: 18 },
  ],
};

function row(index: number, overrides: Record<string, unknown> = {}) {
  const day = String(index + 1).padStart(2, "0");
  return {
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    schema_version: "1.7",
    calculation_version: "digital-athlete-v2",
    computed_at: `2026-09-${day}T09:00:00Z`,
    state: baseState,
    ...overrides,
  };
}

describe("Twin Trend history projection", () => {
  it("returns a compact chronological projection from compatible states", () => {
    const history = buildTwinTrendHistory([row(3), row(0)]);
    expect(history.points.map((point) => point.computedAt)).toEqual([
      "2026-09-01T09:00:00Z",
      "2026-09-04T09:00:00Z",
    ]);
    expect(history.points[0]).not.toHaveProperty("state");
    expect(history.points[0]?.metrics.readiness).toBe(72);
    expect(history.points[0]?.regions[0]).toMatchObject({
      region: "chest",
      recoveryPct: 64,
      volumeKg: 520,
    });
  });

  it("counts incompatible historical model versions without reinterpreting them", () => {
    const history = buildTwinTrendHistory([row(0, { calculation_version: "digital-athlete-v1" })]);
    expect(history.points).toEqual([]);
    expect(history.incompatibleCount).toBe(1);
  });

  it("counts malformed metadata separately from incompatible valid metadata", () => {
    const history = buildTwinTrendHistory([row(0, { computed_at: "bad" }), row(1)]);
    expect(history.points).toHaveLength(1);
    expect(history.omittedCount).toBe(1);
  });

  it("keeps the browser projection bounded", () => {
    const rows = Array.from({ length: TWIN_TREND_LIMIT + 1 }, (_, index) => row(index % 28));
    expect(buildTwinTrendHistory(rows)).toMatchObject({ hasMore: true, limit: TWIN_TREND_LIMIT });
    expect(() => buildTwinTrendHistory([...rows, row(0)])).toThrow();
  });
});

describe("Twin Trend eligibility", () => {
  it("does not call two or three observations an available trend", () => {
    const history = buildTwinTrendHistory([row(0), row(2), row(5)]);
    const series = buildTwinMetricTrend(history, "readiness");
    expect(series.availability).toBe("insufficient_points");
    expect(series.direction).toBeNull();
  });

  it("requires temporal spread even when four snapshots exist", () => {
    const rows = [0, 1, 2, 3].map((index) =>
      row(index, { computed_at: `2026-09-01T0${index}:00:00Z` }),
    );
    const series = buildTwinMetricTrend(buildTwinTrendHistory(rows), "readiness");
    expect(series.pointCount).toBe(4);
    expect(series.availability).toBe("insufficient_span");
    expect(series.direction).toBeNull();
  });

  it("reports descriptive latest-minus-earliest direction after four points over 72 hours", () => {
    const history = buildTwinTrendHistory(
      [0, 1, 2, 3].map((index) =>
        row(index, {
          state: {
            ...baseState,
            recovery: { ...baseState.recovery, latestReadinessScore: 60 + index * 2 },
          },
        }),
      ),
    );
    const series = buildTwinMetricTrend(history, "readiness");
    expect(series).toMatchObject({
      availability: "available",
      pointCount: 4,
      spanHours: 72,
      earliestValue: 60,
      latestValue: 66,
      netChange: 6,
      direction: "higher",
    });
  });

  it("skips missing measurements instead of inventing values", () => {
    const history = buildTwinTrendHistory([
      row(0, { state: { ...baseState, body: { ...baseState.body, latestWeightKg: null } } }),
      row(1),
      row(2),
      row(3),
    ]);
    const series = buildTwinMetricTrend(history, "weightKg");
    expect(series.pointCount).toBe(3);
    expect(series.availability).toBe("insufficient_points");
  });

  it("uses the same eligibility rules for region recovery observations", () => {
    const history = buildTwinTrendHistory(
      [0, 1, 2, 3].map((index) =>
        row(index, {
          state: {
            ...baseState,
            muscleLoad: [
              {
                muscleGroup: "chest",
                volumeKg: 500 + index * 10,
                recoveryPct: 55 + index * 3,
                lastTrainedHoursAgo: 18,
              },
            ],
          },
        }),
      ),
    );
    expect(buildTwinRegionTrend(history, "chest", "recoveryPct")).toMatchObject({
      availability: "available",
      earliestValue: 55,
      latestValue: 64,
      direction: "higher",
    });
  });
});
