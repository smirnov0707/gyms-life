import { describe, expect, it } from "vitest";
import { buildDigitalAthleteState } from "./digital-athlete.service";

describe("buildDigitalAthleteState", () => {
  const now = new Date("2026-09-02T12:00:00.000Z");

  it("derives a bounded, deterministic athlete state from validated facts", () => {
    const state = buildDigitalAthleteState(
      {
        workouts: [
          { started_at: "2026-09-01T09:00:00.000Z", total_volume: 1200 },
          { started_at: "2026-08-20T09:00:00.000Z", total_volume: 800 },
          { started_at: "2026-08-14T09:00:00.000Z", total_volume: 900 },
        ],
        workoutResponses: [
          { started_at: "2026-09-01T09:00:00.000Z", feeling: 4 },
          { started_at: "2026-08-20T09:00:00.000Z", feeling: 3 },
          { started_at: "2026-08-14T09:00:00.000Z", feeling: 5 },
        ],
        checkins: [
          { checkin_on: "2026-09-02", readiness_score: 72, sleep_hours: 7.5 },
          { checkin_on: "2026-09-01", readiness_score: 68, sleep_hours: 6.5 },
          { checkin_on: "2026-08-30", readiness_score: 75, sleep_hours: 8 },
        ],
        bodyMetrics: [
          { measured_on: "2026-09-01", weight_kg: 80, body_fat: 18 },
          { measured_on: "2026-08-10", weight_kg: 81.2, body_fat: 18.5 },
        ],
        nutritionLogs: [
          { logged_on: "2026-09-02", calories: 2200, protein: 160 },
          { logged_on: "2026-09-01", calories: 2000, protein: 140 },
          { logged_on: "2026-08-31", calories: 2100, protein: 150 },
          { logged_on: "2026-08-30", calories: 2300, protein: 170 },
          { logged_on: "2026-08-29", calories: 2050, protein: 145 },
        ],
        decisionFeedback: [
          { decision_on: "2026-09-02", outcome: "completed" },
          { decision_on: "2026-09-01", outcome: "accepted" },
          { decision_on: "2026-08-31", outcome: "not_helpful" },
        ],
        lifeContexts: [],
        trainingRhythm: {
          preferredWeekdays: [1, 3, 5],
          updatedAt: "2026-08-01T09:00:00.000Z",
        },
        availability: {
          training: true,
          recovery: true,
          body: true,
          nutrition: true,
          decisionFeedback: true,
          context: true,
          trainingRhythm: true,
          trainingResponse: true,
        },
      },
      now,
    );

    expect(state).toEqual({
      schemaVersion: "1.5",
      training: {
        sessionsLast7Days: 1,
        sessionsLast28Days: 3,
        totalVolumeLast28Days: 2900,
        daysSinceLastCompletedWorkout: 1,
        selfReportedResponse: {
          source: "user_reported",
          available: true,
          ratedSessionsLast28Days: 3,
          latestFeeling: 4,
          averageFeelingLast28Days: 4,
        },
      },
      recovery: {
        checkinsLast7Days: 3,
        latestReadinessScore: 72,
        averageReadinessLast7Days: 71.7,
        averageSleepHoursLast7Days: 7.3,
      },
      body: {
        measurementsLast30Days: 2,
        latestWeightKg: 80,
        latestBodyFatPercent: 18,
        weightChangeKgLast30Days: -1.2,
      },
      nutrition: {
        loggedDaysLast14Days: 5,
        averageCaloriesOnLoggedDays: 2130,
        averageProteinGOnLoggedDays: 153,
      },
      currentDay: {
        day: "2026-09-02",
        weekday: 3,
        hasCompletedReadiness: true,
        hasCompletedWorkout: false,
        hasLoggedNutrition: true,
      },
      behavior: {
        status: "measured",
        preferredWeekdays: [1, 3, 5],
        usualTrainingDaysLast28Days: 12,
        completedUsualTrainingDaysLast28Days: 1,
        completedFlexibleTrainingDaysLast28Days: 2,
        usualDayCompletionRateLast28Days: 0.08,
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
        evidenceCount: 13,
        availableDomains: ["training", "recovery", "body", "nutrition"],
      },
      dataGaps: [],
    });
  });

  it("reports a cold start and source availability gaps without inventing a recommendation", () => {
    const state = buildDigitalAthleteState(
      {
        workouts: [],
        workoutResponses: [],
        checkins: [],
        bodyMetrics: [],
        nutritionLogs: [],
        decisionFeedback: [],
        lifeContexts: [],
        trainingRhythm: null,
        availability: {
          training: false,
          recovery: false,
          body: false,
          nutrition: false,
          decisionFeedback: false,
          context: false,
          trainingRhythm: false,
          trainingResponse: false,
        },
      },
      now,
    );

    expect(state.dataQuality).toEqual({
      level: "cold_start",
      evidenceCount: 0,
      availableDomains: [],
    });
    expect(state.dataGaps).toEqual([
      "training_data_unavailable",
      "recovery_data_unavailable",
      "body_measurements_unavailable",
      "nutrition_data_unavailable",
      "current_context_unavailable",
      "training_rhythm_data_unavailable",
    ]);
  });

  it("keeps explicit session feelings separate from inferred readiness", () => {
    const state = buildDigitalAthleteState(
      {
        workouts: [{ started_at: "2026-09-01T09:00:00.000Z", total_volume: 1200 }],
        workoutResponses: [
          { started_at: "2026-09-01T09:00:00.000Z", feeling: 2 },
          { started_at: "2026-08-01T09:00:00.000Z", feeling: 5 },
        ],
        checkins: [],
        bodyMetrics: [],
        nutritionLogs: [],
        decisionFeedback: [],
        lifeContexts: [],
        trainingRhythm: null,
        availability: {
          training: true,
          trainingResponse: true,
          recovery: true,
          body: true,
          nutrition: true,
          decisionFeedback: true,
          context: true,
          trainingRhythm: true,
        },
      },
      now,
    );

    expect(state.training.selfReportedResponse).toEqual({
      source: "user_reported",
      available: true,
      ratedSessionsLast28Days: 1,
      latestFeeling: 2,
      averageFeelingLast28Days: 2,
    });
    expect(state.recovery.latestReadinessScore).toBeNull();
  });

  it("does not classify stale rows as current evidence", () => {
    const state = buildDigitalAthleteState(
      {
        workouts: [{ started_at: "2026-06-01T09:00:00.000Z", total_volume: 1200 }],
        workoutResponses: [{ started_at: "2026-06-01T09:00:00.000Z", feeling: 4 }],
        checkins: [{ checkin_on: "2026-06-01", readiness_score: 80, sleep_hours: 8 }],
        bodyMetrics: [{ measured_on: "2026-06-01", weight_kg: 80, body_fat: 18 }],
        nutritionLogs: [{ logged_on: "2026-06-01", calories: 2200, protein: 160 }],
        decisionFeedback: [],
        lifeContexts: [],
        trainingRhythm: null,
        availability: {
          training: true,
          recovery: true,
          body: true,
          nutrition: true,
          decisionFeedback: true,
          context: true,
          trainingRhythm: true,
          trainingResponse: true,
        },
      },
      now,
    );

    expect(state.dataQuality).toEqual({
      level: "cold_start",
      evidenceCount: 0,
      availableDomains: ["training", "recovery", "body", "nutrition"],
    });
    expect(state.dataGaps).toEqual([
      "no_completed_workouts_28d",
      "no_recovery_checkins_7d",
      "no_body_measurements_30d",
      "no_nutrition_logs_14d",
    ]);
  });

  it("retains a user-reported temporary limitation as current state without inflating model maturity", () => {
    const state = buildDigitalAthleteState(
      {
        workouts: [],
        workoutResponses: [],
        checkins: [],
        bodyMetrics: [],
        nutritionLogs: [],
        decisionFeedback: [],
        lifeContexts: [
          {
            id: "018f2e48-5e6d-7b8c-9d0e-1f2a3b4c5d6e",
            content: "Temporary context: temporary_limitation",
            expiresAt: "2026-09-03T18:00:00.000Z",
            context: { kind: "temporary_limitation" },
          },
        ],
        trainingRhythm: null,
        availability: {
          training: true,
          recovery: true,
          body: true,
          nutrition: true,
          decisionFeedback: true,
          context: true,
          trainingRhythm: true,
          trainingResponse: true,
        },
      },
      now,
    );

    expect(state.currentContext).toMatchObject({
      hasSafetyConstraint: true,
      hasTrainingConstraint: false,
    });
    expect(state.dataQuality.level).toBe("cold_start");
  });

  it("uses only three or more explicit decision outcomes for a feedback rate", () => {
    const state = buildDigitalAthleteState(
      {
        workouts: [],
        workoutResponses: [],
        checkins: [],
        bodyMetrics: [],
        nutritionLogs: [],
        decisionFeedback: [
          { decision_on: "2026-09-02", outcome: "accepted" },
          { decision_on: "2026-09-01", outcome: "not_helpful" },
        ],
        lifeContexts: [],
        trainingRhythm: null,
        availability: {
          training: true,
          recovery: true,
          body: true,
          nutrition: true,
          decisionFeedback: true,
          context: true,
          trainingRhythm: true,
          trainingResponse: true,
        },
      },
      now,
    );

    expect(state.decisionFeedback).toEqual({
      available: true,
      ratedDecisionsLast28Days: 2,
      helpfulDecisionOutcomesLast28Days: 1,
      notHelpfulDecisionOutcomesLast28Days: 1,
      helpfulnessRate: null,
    });
  });

  it("uses the caller's local day for date-only evidence near a UTC boundary", () => {
    const state = buildDigitalAthleteState(
      {
        workouts: [],
        workoutResponses: [],
        checkins: [
          { checkin_on: "2026-09-04", readiness_score: 83, sleep_hours: 8 },
          { checkin_on: "2026-08-28", readiness_score: 68, sleep_hours: 7 },
          { checkin_on: "2026-08-27", readiness_score: 30, sleep_hours: 4 },
        ],
        bodyMetrics: [
          { measured_on: "2026-09-04", weight_kg: 80, body_fat: 18 },
          { measured_on: "2026-08-05", weight_kg: 80.5, body_fat: 18.2 },
          { measured_on: "2026-08-04", weight_kg: 81, body_fat: 18.4 },
        ],
        nutritionLogs: [
          { logged_on: "2026-09-04", calories: 2200, protein: 160 },
          { logged_on: "2026-08-21", calories: 2000, protein: 140 },
          { logged_on: "2026-08-20", calories: 1800, protein: 120 },
        ],
        decisionFeedback: [
          { decision_on: "2026-09-04", outcome: "completed" },
          { decision_on: "2026-08-07", outcome: "accepted" },
          { decision_on: "2026-08-06", outcome: "not_helpful" },
        ],
        lifeContexts: [],
        trainingRhythm: null,
        availability: {
          training: true,
          recovery: true,
          body: true,
          nutrition: true,
          decisionFeedback: true,
          context: true,
          trainingRhythm: true,
          trainingResponse: true,
        },
      },
      new Date("2026-09-03T21:30:00.000Z"),
      "Europe/Vilnius",
    );

    expect(state.recovery).toMatchObject({
      checkinsLast7Days: 2,
      latestReadinessScore: 83,
      averageReadinessLast7Days: 75.5,
    });
    expect(state.currentDay).toEqual({
      day: "2026-09-04",
      weekday: 5,
      hasCompletedReadiness: true,
      hasCompletedWorkout: false,
      hasLoggedNutrition: true,
    });
    expect(state.body).toMatchObject({ measurementsLast30Days: 2, weightChangeKgLast30Days: -0.5 });
    expect(state.nutrition).toMatchObject({
      loggedDaysLast14Days: 2,
      averageCaloriesOnLoggedDays: 2100,
    });
    expect(state.decisionFeedback).toMatchObject({
      ratedDecisionsLast28Days: 2,
      helpfulDecisionOutcomesLast28Days: 2,
    });
  });

  it("derives completed current-day facts with the user's local calendar boundary", () => {
    const state = buildDigitalAthleteState(
      {
        workouts: [{ started_at: "2026-09-03T21:40:00.000Z", total_volume: 900 }],
        workoutResponses: [{ started_at: "2026-09-03T21:40:00.000Z", feeling: 3 }],
        checkins: [{ checkin_on: "2026-09-04", readiness_score: 78, sleep_hours: 8 }],
        bodyMetrics: [],
        nutritionLogs: [{ logged_on: "2026-09-04", calories: 2200, protein: 160 }],
        decisionFeedback: [],
        lifeContexts: [],
        trainingRhythm: null,
        availability: {
          training: true,
          recovery: true,
          body: true,
          nutrition: true,
          decisionFeedback: true,
          context: true,
          trainingRhythm: true,
          trainingResponse: true,
        },
      },
      new Date("2026-09-03T21:45:00.000Z"),
      "Europe/Vilnius",
    );

    expect(state.currentDay).toEqual({
      day: "2026-09-04",
      weekday: 5,
      hasCompletedReadiness: true,
      hasCompletedWorkout: true,
      hasLoggedNutrition: true,
    });
  });

  it("observes schedule fit from completed local days without treating today or flexible days as misses", () => {
    const state = buildDigitalAthleteState(
      {
        workouts: [
          { started_at: "2026-09-02T08:00:00.000Z", total_volume: 900 },
          { started_at: "2026-09-01T08:00:00.000Z", total_volume: 900 },
          { started_at: "2026-08-31T08:00:00.000Z", total_volume: 900 },
          { started_at: "2026-08-28T08:00:00.000Z", total_volume: 900 },
          { started_at: "2026-08-28T17:00:00.000Z", total_volume: 900 },
        ],
        workoutResponses: [],
        checkins: [],
        bodyMetrics: [],
        nutritionLogs: [],
        decisionFeedback: [],
        lifeContexts: [],
        trainingRhythm: {
          preferredWeekdays: [1, 3, 5],
          updatedAt: "2026-08-01T09:00:00.000Z",
        },
        availability: {
          training: true,
          recovery: true,
          body: true,
          nutrition: true,
          decisionFeedback: true,
          context: true,
          trainingRhythm: true,
          trainingResponse: true,
        },
      },
      now,
      "UTC",
    );

    expect(state.behavior).toEqual({
      status: "measured",
      preferredWeekdays: [1, 3, 5],
      usualTrainingDaysLast28Days: 12,
      completedUsualTrainingDaysLast28Days: 2,
      completedFlexibleTrainingDaysLast28Days: 1,
      usualDayCompletionRateLast28Days: 0.17,
    });
  });
});
