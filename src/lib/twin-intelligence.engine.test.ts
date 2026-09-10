import { describe, expect, it } from "vitest";
import { DigitalAthleteStateSchema } from "./digital-athlete.schema";
import { buildTwinIntelligence } from "./twin-intelligence.engine";

function state(overrides: Record<string, unknown> = {}) {
  return DigitalAthleteStateSchema.parse({
    schemaVersion: "1.7",
    training: {
      sessionsLast7Days: 3,
      sessionsLast28Days: 10,
      totalVolumeLast28Days: 12500,
      daysSinceLastCompletedWorkout: 1,
      selfReportedResponse: {
        source: "user_reported",
        available: true,
        ratedSessionsLast28Days: 0,
        latestFeeling: null,
        averageFeelingLast28Days: null,
        recentLowFeelingStreak: 0,
      },
    },
    recovery: {
      checkinsLast7Days: 5,
      latestReadinessScore: 76,
      averageReadinessLast7Days: 72,
      averageSleepHoursLast7Days: 7.4,
    },
    body: {
      measurementsLast30Days: 2,
      latestWeightKg: 82,
      latestBodyFatPercent: 18,
      weightChangeKgLast30Days: -0.8,
    },
    nutrition: {
      loggedDaysLast14Days: 10,
      averageCaloriesOnLoggedDays: 2400,
      averageProteinGOnLoggedDays: 160,
    },
    currentDay: {
      day: "2026-09-10",
      weekday: 4,
      hasCompletedReadiness: true,
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
      available: true,
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
      evidenceCount: 20,
      availableDomains: ["training", "recovery", "body", "nutrition"],
    },
    dataGaps: [],
    muscleLoad: [
      { muscleGroup: "chest", volumeKg: 4200, recoveryPct: 42, lastTrainedHoursAgo: 18 },
      { muscleGroup: "back", volumeKg: 3800, recoveryPct: 68, lastTrainedHoursAgo: 30 },
      { muscleGroup: "legs", volumeKg: 5100, recoveryPct: 90, lastTrainedHoursAgo: 72 },
    ],
    ...overrides,
  });
}

describe("Twin Intelligence", () => {
  it("prioritizes recovery attention without claiming diagnosis", () => {
    const result = buildTwinIntelligence(state());
    expect(result.mode).toBe("training_ready");
    expect(result.focusRegions[0]).toMatchObject({
      region: "chest",
      attention: "recovery_attention",
    });
  });
  it("keeps safety context above readiness", () => {
    const base = state();
    const result = buildTwinIntelligence(
      DigitalAthleteStateSchema.parse({
        ...base,
        currentContext: { ...base.currentContext, hasSafetyConstraint: true },
      }),
    );
    expect(result.mode).toBe("context_attention");
  });

  it("does not call a cold start ready", () => {
    const base = state();
    const result = buildTwinIntelligence(
      DigitalAthleteStateSchema.parse({
        ...base,
        dataQuality: { ...base.dataQuality, level: "cold_start" },
      }),
    );
    expect(result.mode).toBe("insufficient_evidence");
  });
});
