import { describe, expect, it } from "vitest";
import type { DigitalAthleteState } from "./digital-athlete.schema";
import { buildTwinRewindHistory, compareTwinRewindPoints, TWIN_REWIND_LIMIT } from "./twin-rewind";

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

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    schema_version: "1.7",
    calculation_version: "digital-athlete-v2",
    computed_at: "2026-09-06T09:00:00Z",
    source_window_start: "2026-08-07T09:00:00Z",
    source_window_end: "2026-09-06T09:00:00Z",
    state: baseState,
    ...overrides,
  };
}

describe("Twin Rewind history projection", () => {
  it("maps a compatible immutable state into a historical Twin projection", () => {
    const history = buildTwinRewindHistory([row()]);
    const point = history.points[0];
    expect(point).toMatchObject({
      compatible: true,
      calculationVersion: "digital-athlete-v2",
      schemaVersion: "1.7",
      dataQualityLevel: "informed",
    });
    expect(point?.metrics).toMatchObject({
      sessionsLast7Days: 2,
      readiness: 72,
      weightKg: 81.4,
      evidenceCount: 23,
    });
    expect(point?.twin?.computedAt).toBe("2026-09-06T09:00:00.000Z");
    expect(point?.twin?.regions.find((region) => region.region === "chest")).toMatchObject({
      recoveryPct: 64,
      provenance: "calculated",
    });
  });

  it("does not reinterpret a state produced by another calculation version", () => {
    const history = buildTwinRewindHistory([row({ calculation_version: "digital-athlete-v1" })]);
    expect(history.incompatibleCount).toBe(1);
    expect(history.points[0]).toMatchObject({ compatible: false, metrics: null, twin: null });
  });

  it("does not expose a state whose stored schema is no longer supported", () => {
    const history = buildTwinRewindHistory([row({ schema_version: "1.6" })]);
    expect(history.points[0]?.compatible).toBe(false);
    expect(history.points[0]?.metrics).toBeNull();
  });

  it("withholds an invalid state rather than filling it with healthy defaults", () => {
    const history = buildTwinRewindHistory([row({ state: { schemaVersion: "1.7" } })]);
    expect(history.points[0]?.compatible).toBe(false);
    expect(history.points[0]?.twin).toBeNull();
  });

  it("counts malformed snapshot metadata without converting it to an empty history", () => {
    const history = buildTwinRewindHistory([row({ computed_at: "not-a-date" }), row()]);
    expect(history.points).toHaveLength(1);
    expect(history.omittedCount).toBe(1);
  });

  it("orders by the actual instant and then descending id", () => {
    const history = buildTwinRewindHistory([
      row(),
      row({
        id: "00000000-0000-4000-8000-000000000002",
        computed_at: "2026-09-06T10:30:00+01:00",
      }),
    ]);
    expect(history.points[0]?.id).toBe("00000000-0000-4000-8000-000000000002");
  });

  it("is explicit when the bounded history has older rows", () => {
    const rows = Array.from({ length: TWIN_REWIND_LIMIT + 1 }, (_, index) =>
      row({ id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}` }),
    );
    expect(buildTwinRewindHistory(rows)).toMatchObject({
      hasMore: true,
      limit: TWIN_REWIND_LIMIT,
    });
    expect(() => buildTwinRewindHistory([...rows, row()])).toThrow();
  });

  it.each([null, undefined, {}, "bad response"])("rejects malformed response %s", (value) => {
    expect(() => buildTwinRewindHistory(value)).toThrow();
  });
});

describe("Twin Rewind comparison", () => {
  it("calculates factual newer-minus-older deltas without assigning meaning", () => {
    const older = buildTwinRewindHistory([
      row({
        id: "00000000-0000-4000-8000-000000000010",
        computed_at: "2026-09-05T09:00:00Z",
        state: {
          ...baseState,
          training: { ...baseState.training, sessionsLast7Days: 1, totalVolumeLast28Days: 4000 },
          recovery: { ...baseState.recovery, latestReadinessScore: 68 },
          body: { ...baseState.body, latestWeightKg: 81.8 },
          dataQuality: { ...baseState.dataQuality, evidenceCount: 20 },
        },
      }),
    ]).points[0];
    const newer = buildTwinRewindHistory([row()]).points[0];
    expect(compareTwinRewindPoints(older, newer)).toMatchObject({
      sessionsLast7Days: 1,
      totalVolumeLast28Days: 200,
      readiness: 4,
      weightKg: -0.4,
      evidenceCount: 3,
    });
  });

  it("keeps a missing metric delta unknown", () => {
    const older = buildTwinRewindHistory([
      row({
        id: "00000000-0000-4000-8000-000000000010",
        state: {
          ...baseState,
          recovery: { ...baseState.recovery, latestReadinessScore: null },
        },
      }),
    ]).points[0];
    const newer = buildTwinRewindHistory([row()]).points[0];
    expect(compareTwinRewindPoints(older, newer)?.readiness).toBeNull();
  });

  it("refuses comparison when either state is incompatible", () => {
    const incompatible = buildTwinRewindHistory([
      row({ calculation_version: "digital-athlete-v1" }),
    ]).points[0];
    const current = buildTwinRewindHistory([row()]).points[0];
    expect(compareTwinRewindPoints(incompatible, current)).toBeNull();
  });
});
