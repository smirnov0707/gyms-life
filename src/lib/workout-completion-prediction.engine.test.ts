import { describe, expect, it } from "vitest";
import { DigitalAthleteStateSchema } from "./digital-athlete.schema";
import {
  MIN_USUAL_DAYS_FOR_COMPLETION_PREDICTION,
  predictWorkoutCompletion,
} from "./workout-completion-prediction.engine";

function makeState(overrides?: {
  weekday?: number;
  preferredWeekdays?: number[];
  usualDays?: number;
  completedUsualDays?: number;
}) {
  const usualDays = overrides?.usualDays ?? 8;
  const completedUsualDays = overrides?.completedUsualDays ?? 6;

  return DigitalAthleteStateSchema.parse({
    schemaVersion: "1.7",
    training: {
      sessionsLast7Days: 2,
      sessionsLast28Days: 8,
      totalVolumeLast28Days: 12000,
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
      checkinsLast7Days: 3,
      latestReadinessScore: 74,
      averageReadinessLast7Days: 72,
      averageSleepHoursLast7Days: 7.1,
    },
    body: {
      measurementsLast30Days: 1,
      latestWeightKg: 82,
      latestBodyFatPercent: null,
      weightChangeKgLast30Days: null,
    },
    nutrition: {
      loggedDaysLast14Days: 0,
      averageCaloriesOnLoggedDays: null,
      averageProteinGOnLoggedDays: null,
    },
    currentDay: {
      day: "2026-09-05",
      weekday: overrides?.weekday ?? 6,
      hasCompletedReadiness: true,
      hasCompletedWorkout: false,
      hasLoggedNutrition: false,
    },
    behavior: {
      status: "measured",
      preferredWeekdays: overrides?.preferredWeekdays ?? [2, 4, 6],
      usualTrainingDaysLast28Days: usualDays,
      completedUsualTrainingDaysLast28Days: completedUsualDays,
      completedFlexibleTrainingDaysLast28Days: 1,
      usualDayCompletionRateLast28Days: Math.round((completedUsualDays / usualDays) * 100) / 100,
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
      level: "building",
      evidenceCount: 12,
      availableDomains: ["training", "recovery", "body"],
    },
    dataGaps: ["no_nutrition_logs_14d"],
    muscleLoad: [],
  });
}

const common = {
  predictionId: "550e8400-e29b-41d4-a716-446655440000",
  generatedAt: "2026-09-05T08:00:00+03:00",
  horizonEndsAt: "2026-09-05T23:59:00+03:00",
  athleteStateSnapshotId: null,
  workoutRecommendedToday: true,
};

describe("predictWorkoutCompletion", () => {
  it("creates a shadow probability from observed usual-day completion", () => {
    const prediction = predictWorkoutCompletion({ ...common, state: makeState() });

    expect(prediction?.maturity).toBe("shadow");
    expect(prediction?.target).toBe("workout_completion");
    expect(prediction?.predicted).toEqual({ kind: "probability", value: 0.75 });
  });

  it("does not predict when Today did not recommend training", () => {
    expect(
      predictWorkoutCompletion({ ...common, workoutRecommendedToday: false, state: makeState() }),
    ).toBeNull();
  });

  it("does not extrapolate a usual-day model to a flexible day", () => {
    expect(predictWorkoutCompletion({ ...common, state: makeState({ weekday: 1 }) })).toBeNull();
  });

  it("withholds a prediction below the minimum history", () => {
    const usualDays = MIN_USUAL_DAYS_FOR_COMPLETION_PREDICTION - 1;
    expect(
      predictWorkoutCompletion({
        ...common,
        state: makeState({ usualDays, completedUsualDays: usualDays - 1 }),
      }),
    ).toBeNull();
  });

  it("raises evidence level only from sample count, never fake confidence", () => {
    const moderate = predictWorkoutCompletion({
      ...common,
      state: makeState({ usualDays: 8, completedUsualDays: 6 }),
    });
    const strong = predictWorkoutCompletion({
      ...common,
      state: makeState({ usualDays: 12, completedUsualDays: 9 }),
    });

    expect(moderate?.evidenceLevel).toBe("moderate");
    expect(strong?.evidenceLevel).toBe("strong");
  });
});
