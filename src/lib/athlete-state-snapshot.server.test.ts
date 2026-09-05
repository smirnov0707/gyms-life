import { describe, expect, it } from "vitest";
import { DigitalAthleteStateSchema } from "./digital-athlete.schema";
import {
  canPersistDigitalAthleteState,
  fingerprintDigitalAthleteState,
} from "./athlete-state-snapshot.server";

const informedState = DigitalAthleteStateSchema.parse({
  schemaVersion: "1.7",
  muscleLoad: [],
  training: {
    sessionsLast7Days: 3,
    sessionsLast28Days: 10,
    totalVolumeLast28Days: 8200,
    daysSinceLastCompletedWorkout: 1,
    selfReportedResponse: {
      source: "user_reported",
      available: true,
      ratedSessionsLast28Days: 3,
      latestFeeling: 4,
      averageFeelingLast28Days: 3.7,
      recentLowFeelingStreak: 0,
    },
  },
  recovery: {
    checkinsLast7Days: 4,
    latestReadinessScore: 74,
    averageReadinessLast7Days: 71,
    averageSleepHoursLast7Days: 7.4,
  },
  body: {
    measurementsLast30Days: 3,
    latestWeightKg: 80,
    latestBodyFatPercent: 18,
    weightChangeKgLast30Days: -0.7,
  },
  nutrition: {
    loggedDaysLast14Days: 9,
    averageCaloriesOnLoggedDays: 2360,
    averageProteinGOnLoggedDays: 164,
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
    evidenceCount: 31,
    availableDomains: ["training", "recovery", "body", "nutrition"],
  },
  dataGaps: [],
});

describe("Digital Athlete snapshot persistence", () => {
  it("uses a stable SHA-256 fingerprint for the same validated state", () => {
    const sameState = DigitalAthleteStateSchema.parse(JSON.parse(JSON.stringify(informedState)));

    expect(fingerprintDigitalAthleteState(informedState)).toMatch(/^[a-f0-9]{64}$/);
    expect(fingerprintDigitalAthleteState(sameState)).toBe(
      fingerprintDigitalAthleteState(informedState),
    );
  });

  it("does not retain a snapshot when a source query was unavailable", () => {
    const unavailableState = DigitalAthleteStateSchema.parse({
      ...informedState,
      dataGaps: ["nutrition_data_unavailable"],
    });

    expect(canPersistDigitalAthleteState(informedState)).toBe(true);
    expect(canPersistDigitalAthleteState(unavailableState)).toBe(false);
  });
});
