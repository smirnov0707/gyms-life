import { describe, expect, it } from "vitest";
import { DigitalAthleteStateSchema, type DigitalAthleteDataGap } from "./digital-athlete.schema";
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

  it.each([
    "training_data_unavailable",
    "training_response_data_unavailable",
    "recovery_data_unavailable",
    "body_measurements_unavailable",
    "nutrition_data_unavailable",
    "muscle_load_data_unavailable",
    "current_context_unavailable",
    "training_rhythm_data_unavailable",
    "decision_feedback_data_unavailable",
    "personalization_consent_required",
    "personalization_consent_unavailable",
  ] satisfies DigitalAthleteDataGap[])("does not retain incomplete state for %s", (gap) => {
    const state = DigitalAthleteStateSchema.parse({
      ...informedState,
      dataGaps: ["no_nutrition_logs_14d", gap],
    });

    expect(canPersistDigitalAthleteState(state)).toBe(false);
  });

  it("allows readable sources with no observations, individually and together", () => {
    const gaps: DigitalAthleteDataGap[] = [
      "no_completed_workouts_28d",
      "no_recovery_checkins_7d",
      "no_body_measurements_30d",
      "no_nutrition_logs_14d",
    ];
    for (const dataGaps of [...gaps.map((gap) => [gap]), gaps]) {
      const state = DigitalAthleteStateSchema.parse({ ...informedState, dataGaps });
      expect(canPersistDigitalAthleteState(state)).toBe(true);
    }
    expect(canPersistDigitalAthleteState(informedState)).toBe(true);
  });
});

it("keeps snapshots from different calculation versions distinct", () => {
  expect(fingerprintDigitalAthleteState(informedState, "digital-athlete-v1")).not.toBe(
    fingerprintDigitalAthleteState(informedState, "digital-athlete-v2"),
  );
});
