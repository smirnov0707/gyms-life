import { describe, expect, it } from "vitest";
import { buildCalculatedMemoryCandidates } from "./deterministic-memory.service";
import type { DigitalAthleteState } from "./digital-athlete.schema";

const completeState: DigitalAthleteState = {
  schemaVersion: "1.6",
  training: {
    sessionsLast7Days: 3,
    sessionsLast28Days: 10,
    totalVolumeLast28Days: 14_200,
    daysSinceLastCompletedWorkout: 1,
    selfReportedResponse: {
      source: "user_reported",
      available: true,
      ratedSessionsLast28Days: 3,
      latestFeeling: 3,
      averageFeelingLast28Days: 3.7,
      recentLowFeelingStreak: 0,
    },
  },
  recovery: {
    checkinsLast7Days: 4,
    latestReadinessScore: 48,
    averageReadinessLast7Days: 52.5,
    averageSleepHoursLast7Days: 6.4,
  },
  body: {
    measurementsLast30Days: 3,
    latestWeightKg: 79.2,
    latestBodyFatPercent: null,
    weightChangeKgLast30Days: -1.4,
  },
  nutrition: {
    loggedDaysLast14Days: 11,
    averageCaloriesOnLoggedDays: 2_120,
    averageProteinGOnLoggedDays: 154,
  },
  currentDay: {
    day: "2026-09-03",
    weekday: 3,
    hasCompletedReadiness: true,
    hasCompletedWorkout: false,
    hasLoggedNutrition: false,
  },
  behavior: {
    status: "measured",
    preferredWeekdays: [1, 3, 5],
    usualTrainingDaysLast28Days: 12,
    completedUsualTrainingDaysLast28Days: 8,
    completedFlexibleTrainingDaysLast28Days: 2,
    usualDayCompletionRateLast28Days: 0.67,
  },
  decisionFeedback: {
    available: true,
    ratedDecisionsLast28Days: 3,
    helpfulDecisionOutcomesLast28Days: 2,
    notHelpfulDecisionOutcomesLast28Days: 1,
    helpfulnessRate: 0.67,
  },
  currentContext: {
    active: [],
    shortestAvailableSessionMinutes: null,
    hasTrainingConstraint: false,
    hasSafetyConstraint: false,
  },
  dataQuality: {
    level: "informed",
    evidenceCount: 28,
    availableDomains: ["training", "recovery", "body", "nutrition"],
  },
  dataGaps: [],
};

describe("calculated user memory", () => {
  it("creates bounded, evidence-ready claims only from sufficient observed data", () => {
    const candidates = buildCalculatedMemoryCandidates(completeState);

    expect(candidates.map((candidate) => candidate.memoryKey)).toEqual([
      "derived:training_consistency_28d",
      "derived:training_rhythm_observation_28d",
      "derived:recovery_low_7d",
      "derived:weight_change_30d",
      "derived:nutrition_logging_14d",
    ]);
    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          memoryType: "recovery_pattern",
          evidenceState: "calculated_threshold_met",
          value: {
            kind: "recovery_low_7d",
            averageReadiness: 52.5,
            checkinsLast7Days: 4,
            windowDays: 7,
          },
        }),
        expect.objectContaining({
          content: "Recorded weight changed by -1.4 kg across 3 measurements in the last 30 days.",
        }),
      ]),
    );
  });

  it("does not manufacture insights when evidence is insufficient", () => {
    const candidates = buildCalculatedMemoryCandidates({
      ...completeState,
      training: { ...completeState.training, sessionsLast28Days: 7 },
      recovery: {
        ...completeState.recovery,
        checkinsLast7Days: 2,
        averageReadinessLast7Days: 40,
      },
      body: {
        ...completeState.body,
        measurementsLast30Days: 1,
        weightChangeKgLast30Days: null,
      },
      nutrition: { ...completeState.nutrition, loggedDaysLast14Days: 9 },
      behavior: {
        status: "not_configured",
        preferredWeekdays: [],
        usualTrainingDaysLast28Days: null,
        completedUsualTrainingDaysLast28Days: null,
        completedFlexibleTrainingDaysLast28Days: null,
        usualDayCompletionRateLast28Days: null,
      },
    });

    expect(candidates).toEqual([]);
  });
});
