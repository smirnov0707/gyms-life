import type { DigitalAthleteState } from "../../src/lib/digital-athlete.schema";
import { buildTwinTrendHistory } from "../../src/lib/twin-trend";
import { DIGITAL_ATHLETE_CALCULATION_VERSION } from "../../src/lib/digital-athlete.service";

// Synthetic source rows pass through the real schema and history projection.
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
  muscleLoad: [{ muscleGroup: "chest", volumeKg: 520, recoveryPct: 64, lastTrainedHoursAgo: 18 }],
};

export function trendFixture() {
  const scenario = new URLSearchParams(location.search).get("scenario");
  const days =
    scenario === "empty" || scenario === "excluded"
      ? []
      : scenario === "single"
        ? [0]
        : scenario === "short-span"
          ? [0, 0.1, 0.2, 0.3]
          : [0, 1, 3, 6];
  const rows = days.map((day, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    schema_version: "1.7",
    calculation_version: DIGITAL_ATHLETE_CALCULATION_VERSION,
    computed_at: new Date(Date.UTC(2026, 8, 20, 21, 30) + day * 86400000).toISOString(),
    state: {
      ...baseState,
      recovery: {
        ...baseState.recovery,
        latestReadinessScore: scenario === "flat" ? 60 : 60 + index * 4,
        averageSleepHoursLast7Days: index === 2 ? null : 7 + index / 10,
      },
      body: { ...baseState.body, latestWeightKg: null },
      muscleLoad: [
        {
          muscleGroup: "chest",
          volumeKg: index * 520,
          recoveryPct: 80 - index * 4,
          lastTrainedHoursAgo: 18,
        },
      ],
    },
  }));
  if (scenario === "excluded")
    return buildTwinTrendHistory([
      null,
      {
        id: "00000000-0000-4000-8000-000000000009",
        schema_version: "1.6",
        calculation_version: "old",
        computed_at: "2026-09-19T09:00:00Z",
        state: baseState,
      },
    ]);
  return buildTwinTrendHistory(rows);
}
