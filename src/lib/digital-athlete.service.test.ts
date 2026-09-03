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
        availability: {
          training: true,
          recovery: true,
          body: true,
          nutrition: true,
          decisionFeedback: true,
          context: true,
        },
      },
      now,
    );

    expect(state).toEqual({
      schemaVersion: "1.2",
      training: {
        sessionsLast7Days: 1,
        sessionsLast28Days: 3,
        totalVolumeLast28Days: 2900,
        daysSinceLastCompletedWorkout: 1,
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
        checkins: [],
        bodyMetrics: [],
        nutritionLogs: [],
        decisionFeedback: [],
        lifeContexts: [],
        availability: {
          training: false,
          recovery: false,
          body: false,
          nutrition: false,
          decisionFeedback: false,
          context: false,
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
    ]);
  });

  it("does not classify stale rows as current evidence", () => {
    const state = buildDigitalAthleteState(
      {
        workouts: [{ started_at: "2026-06-01T09:00:00.000Z", total_volume: 1200 }],
        checkins: [{ checkin_on: "2026-06-01", readiness_score: 80, sleep_hours: 8 }],
        bodyMetrics: [{ measured_on: "2026-06-01", weight_kg: 80, body_fat: 18 }],
        nutritionLogs: [{ logged_on: "2026-06-01", calories: 2200, protein: 160 }],
        decisionFeedback: [],
        lifeContexts: [],
        availability: {
          training: true,
          recovery: true,
          body: true,
          nutrition: true,
          decisionFeedback: true,
          context: true,
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
        availability: {
          training: true,
          recovery: true,
          body: true,
          nutrition: true,
          decisionFeedback: true,
          context: true,
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
        checkins: [],
        bodyMetrics: [],
        nutritionLogs: [],
        decisionFeedback: [
          { decision_on: "2026-09-02", outcome: "accepted" },
          { decision_on: "2026-09-01", outcome: "not_helpful" },
        ],
        lifeContexts: [],
        availability: {
          training: true,
          recovery: true,
          body: true,
          nutrition: true,
          decisionFeedback: true,
          context: true,
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
});
