import { describe, expect, it } from "vitest";
import type { DigitalAthleteState } from "./digital-athlete.schema";
import { UserMemoryTransparencyItemResultSchema } from "./user-memory.schema";
import { buildWeeklyIntelligenceReview } from "./weekly-intelligence.engine";

const informedState: DigitalAthleteState = {
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
    latestReadinessScore: 62,
    averageReadinessLast7Days: 58.5,
    averageSleepHoursLast7Days: 7.1,
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

const calculatedMemory = UserMemoryTransparencyItemResultSchema.parse({
  id: "018f2e48-5e6d-7b8c-9d0e-1f2a3b4c5d6e",
  type: "recovery_pattern",
  content: "Average readiness was 52.5/100 across four check-ins.",
  source: "calculated",
  confidence: 0.8,
  importance: 0.8,
  status: "active",
  calculatedValue: {
    kind: "recovery_low_7d",
    averageReadiness: 52.5,
    checkinsLast7Days: 4,
    windowDays: 7,
  },
  evidenceCount: 1,
  lastConfirmedAt: "2026-09-03T09:00:00.000Z",
  expiresAt: null,
});

describe("weekly intelligence review", () => {
  it("surfaces only validated calculated discoveries with a single next action", () => {
    const review = buildWeeklyIntelligenceReview({
      state: informedState,
      memories: [calculatedMemory],
    });

    expect(review).toMatchObject({
      status: "ready",
      thisWeek: {
        completedWorkouts: 3,
        readinessCheckins: 4,
        averageReadiness: 58.5,
      },
      nextAction: { action: "open_today" },
      stillLearning: [],
    });
    expect(review.discoveries).toEqual([
      expect.objectContaining({
        source: "calculated",
        calculatedValue: {
          kind: "recovery_low_7d",
          averageReadiness: 52.5,
          checkinsLast7Days: 4,
          windowDays: 7,
        },
      }),
    ]);
  });

  it("does not manufacture discoveries when the athlete model is still learning", () => {
    const review = buildWeeklyIntelligenceReview({
      state: {
        ...informedState,
        training: { ...informedState.training, sessionsLast7Days: 0, sessionsLast28Days: 0 },
        recovery: {
          ...informedState.recovery,
          checkinsLast7Days: 0,
          latestReadinessScore: null,
          averageReadinessLast7Days: null,
          averageSleepHoursLast7Days: null,
        },
        nutrition: {
          ...informedState.nutrition,
          loggedDaysLast14Days: 0,
          averageCaloriesOnLoggedDays: null,
          averageProteinGOnLoggedDays: null,
        },
        dataQuality: {
          level: "cold_start",
          evidenceCount: 0,
          availableDomains: ["training", "recovery", "body", "nutrition"],
        },
        dataGaps: ["no_completed_workouts_28d", "no_recovery_checkins_7d", "no_nutrition_logs_14d"],
      },
      memories: [],
    });

    expect(review.status).toBe("learning");
    expect(review.discoveries).toEqual([]);
    expect(review.nextAction).toEqual({ action: "start_training" });
    expect(review.stillLearning).toEqual([
      "no_completed_workouts_28d",
      "no_recovery_checkins_7d",
      "no_nutrition_logs_14d",
    ]);
  });

  it("does not treat user-authored memory as a system discovery", () => {
    const review = buildWeeklyIntelligenceReview({
      state: informedState,
      memories: [{ ...calculatedMemory, source: "user_reported", calculatedValue: null }],
    });

    expect(review.status).toBe("learning");
    expect(review.discoveries).toEqual([]);
  });
});
