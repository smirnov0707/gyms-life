import { describe, expect, it } from "vitest";
import { evaluateSafetyGuardian } from "./safety-guardian";
import type { DigitalTwinState } from "./digital-athlete.schema";

function makeTwinState(hasSafetyConstraint: boolean): DigitalTwinState {
  return {
    schemaVersion: "1.6",
    training: {
      sessionsLast7Days: 0,
      sessionsLast28Days: 0,
      totalVolumeLast28Days: 0,
      daysSinceLastCompletedWorkout: null,
      selfReportedResponse: {
        source: "user_reported",
        available: false,
        ratedSessionsLast28Days: 0,
        recentLowFeelingStreak: 0,
        latestFeeling: null,
        averageFeelingLast28Days: null,
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
      weekday: "friday",
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
      hasSafetyConstraint,
    },
    dataQuality: {
      level: "cold_start",
      evidenceCount: 0,
      availableDomains: [],
    },
    dataGaps: [],
  };
}

describe("Safety Guardian", () => {
  it("blocks automatic adjustment when an explicit safety constraint exists", () => {
    expect(evaluateSafetyGuardian(makeTwinState(true))).toEqual({
      status: "manual_review_required",
      allowsAutomaticAdjustment: false,
      reasons: ["active_safety_constraint"],
    });
  });

  it("does not invent a safety block when the canonical Twin has none", () => {
    expect(evaluateSafetyGuardian(makeTwinState(false))).toEqual({
      status: "clear",
      allowsAutomaticAdjustment: true,
      reasons: [],
    });
  });
});
