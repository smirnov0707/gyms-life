import { describe, expect, it } from "vitest";
import { DigitalAthleteStateSchema } from "./digital-athlete.schema";
import { buildTodayDecision, fingerprintTodayDecision } from "./today-decision.engine";

const baseState = DigitalAthleteStateSchema.parse({
  schemaVersion: "1.3",
  training: {
    sessionsLast7Days: 2,
    sessionsLast28Days: 5,
    totalVolumeLast28Days: 6400,
    daysSinceLastCompletedWorkout: 1,
  },
  recovery: {
    checkinsLast7Days: 4,
    latestReadinessScore: 76,
    averageReadinessLast7Days: 74,
    averageSleepHoursLast7Days: 7.5,
  },
  body: {
    measurementsLast30Days: 3,
    latestWeightKg: 80,
    latestBodyFatPercent: 18,
    weightChangeKgLast30Days: -0.4,
  },
  nutrition: {
    loggedDaysLast14Days: 8,
    averageCaloriesOnLoggedDays: 2300,
    averageProteinGOnLoggedDays: 160,
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
    evidenceCount: 15,
    availableDomains: ["training", "recovery", "body", "nutrition"],
  },
  dataGaps: [],
});

function input(overrides: Partial<Parameters<typeof buildTodayDecision>[0]> = {}) {
  return {
    decisionOn: "2026-09-03",
    hasActiveTrainingPlan: true,
    hasCompletedReadinessToday: true,
    hasCompletedWorkoutToday: false,
    hasLoggedNutritionToday: false,
    hasOpenWorkout: false,
    activePlanDaysPerWeek: 3,
    activePlanSessionsLast7Days: 2,
    hasPreferredTrainingDayToday: null,
    state: baseState,
    ...overrides,
  };
}

describe("buildTodayDecision", () => {
  it("asks for a plan before training when no active plan exists", () => {
    const decision = buildTodayDecision(input({ hasActiveTrainingPlan: false }));

    expect(decision.action).toBe("generate_training_plan");
    expect(decision.safetyConstraints).toEqual(["requires_active_plan_before_training"]);
  });

  it("requires a same-day readiness check before modifying a planned session", () => {
    const decision = buildTodayDecision(input({ hasCompletedReadinessToday: false }));

    expect(decision.action).toBe("complete_readiness");
    expect(decision.evidence[0]).toMatchObject({ key: "today_readiness", value: "not_recorded" });
  });

  it("still asks for a readiness check before applying a usual recovery-day preference", () => {
    const decision = buildTodayDecision(
      input({ hasCompletedReadinessToday: false, hasPreferredTrainingDayToday: false }),
    );

    expect(decision.action).toBe("complete_readiness");
    expect(decision.evidence).toContainEqual({
      key: "training_rhythm",
      value: "usual_recovery_day",
      sourceClass: "user_reported",
      position: 3,
    });
  });

  it("prefers recovery on a usual recovery day after readiness is known", () => {
    const decision = buildTodayDecision(input({ hasPreferredTrainingDayToday: false }));

    expect(decision.action).toBe("recover");
    expect(decision.alternatives).toEqual(["train_as_planned"]);
    expect(decision.safetyConstraints).toEqual([]);
    expect(decision.evidence[0]).toMatchObject({
      key: "training_rhythm",
      value: "usual_recovery_day",
    });
  });

  it("keeps a usual training day visible in an otherwise normal training decision", () => {
    const decision = buildTodayDecision(input({ hasPreferredTrainingDayToday: true }));

    expect(decision.action).toBe("train_as_planned");
    expect(decision.evidence).toContainEqual({
      key: "training_rhythm",
      value: "usual_training_day",
      sourceClass: "user_reported",
      position: 3,
    });
  });

  it("prioritizes recovery once the active plan frequency target is already met", () => {
    const decision = buildTodayDecision(
      input({
        hasCompletedReadinessToday: false,
        activePlanDaysPerWeek: 3,
        activePlanSessionsLast7Days: 3,
      }),
    );

    expect(decision.action).toBe("recover");
    expect(decision.alternatives).toEqual(["complete_readiness"]);
    expect(decision.safetyConstraints).toEqual([]);
    expect(decision.evidence[0]).toMatchObject({ key: "sessions_last_7_days", value: "3/3" });
  });

  it("resumes an open planned session before applying the weekly frequency target", () => {
    const decision = buildTodayDecision(
      input({
        hasCompletedReadinessToday: false,
        hasOpenWorkout: true,
        activePlanDaysPerWeek: 3,
        activePlanSessionsLast7Days: 3,
      }),
    );

    expect(decision.action).toBe("train_as_planned");
    expect(decision.safetyConstraints).toEqual(["apply_persisted_execution_snapshot"]);
    expect(decision.evidence[0]).toMatchObject({
      key: "active_training_plan",
      value: "open_session",
    });
  });

  it("chooses recovery for low readiness without suggesting progression", () => {
    const lowReadiness = DigitalAthleteStateSchema.parse({
      ...baseState,
      recovery: { ...baseState.recovery, latestReadinessScore: 42 },
    });
    const decision = buildTodayDecision(input({ state: lowReadiness }));

    expect(decision.action).toBe("recover");
    expect(decision.safetyConstraints).toEqual(["avoid_progression_when_readiness_low"]);
    expect(decision.evidence[1]).toMatchObject({ key: "load_modifier", value: "0.80" });
  });

  it("uses the persisted readiness policy for an adapted session", () => {
    const reducedReadiness = DigitalAthleteStateSchema.parse({
      ...baseState,
      recovery: { ...baseState.recovery, latestReadinessScore: 60 },
    });
    const decision = buildTodayDecision(input({ state: reducedReadiness }));

    expect(decision.action).toBe("train_adapted");
    expect(decision.evidence[1]).toMatchObject({ key: "load_modifier", value: "0.90" });
  });

  it("does not prompt a second training session after a completed workout", () => {
    const decision = buildTodayDecision(input({ hasCompletedWorkoutToday: true }));

    expect(decision.action).toBe("log_nutrition");
    expect(decision.safetyConstraints).toEqual(["avoid_duplicate_training_prompt"]);
  });

  it("moves to recovery after a completed workout and same-day nutrition log", () => {
    const decision = buildTodayDecision(
      input({ hasCompletedWorkoutToday: true, hasLoggedNutritionToday: true }),
    );

    expect(decision.action).toBe("recover");
    expect(decision.alternatives).toEqual(["log_nutrition"]);
    expect(decision.evidence[0]).toMatchObject({
      key: "completed_workout_today",
      value: "completed_and_nutrition_logged",
    });
  });

  it("prioritizes recovery when the user has an active temporary limitation", () => {
    const limitedState = DigitalAthleteStateSchema.parse({
      ...baseState,
      currentContext: {
        active: [
          {
            id: "018f2e48-5e6d-7b8c-9d0e-1f2a3b4c5d6e",
            content: "Temporary context: temporary_limitation",
            expiresAt: "2026-09-04T12:00:00.000Z",
            context: { kind: "temporary_limitation" },
          },
        ],
        shortestAvailableSessionMinutes: null,
        hasTrainingConstraint: false,
        hasSafetyConstraint: true,
      },
    });
    const decision = buildTodayDecision(input({ state: limitedState }));

    expect(decision.action).toBe("recover");
    expect(decision.safetyConstraints).toEqual(["avoid_training_with_active_limitation"]);
    expect(decision.evidence[0]).toMatchObject({
      key: "active_life_context",
      value: "temporary_limitation",
    });
  });

  it("routes an executable life constraint to the persisted workout adaptation path", () => {
    const timeLimitedState = DigitalAthleteStateSchema.parse({
      ...baseState,
      currentContext: {
        active: [
          {
            id: "018f2e48-5e6d-7b8c-9d0e-1f2a3b4c5d6f",
            content: "Temporary context: time_limited (30 min)",
            expiresAt: "2026-09-04T12:00:00.000Z",
            context: { kind: "time_limited", minutes: 30 },
          },
        ],
        shortestAvailableSessionMinutes: 30,
        hasTrainingConstraint: true,
        hasSafetyConstraint: false,
      },
    });
    const decision = buildTodayDecision(input({ state: timeLimitedState }));

    expect(decision.action).toBe("train_adapted");
    expect(decision.safetyConstraints).toContain("apply_persisted_execution_snapshot");
    expect(decision.evidence.at(-1)).toMatchObject({
      key: "active_life_context",
      value: "time_limited",
    });
  });

  it("routes travel through the persisted adapted-session path", () => {
    const travelState = DigitalAthleteStateSchema.parse({
      ...baseState,
      currentContext: {
        active: [
          {
            id: "018f2e48-5e6d-7b8c-9d0e-1f2a3b4c5d70",
            content: "Temporary context: travel",
            expiresAt: "2026-09-04T12:00:00.000Z",
            context: { kind: "travel" },
          },
        ],
        shortestAvailableSessionMinutes: null,
        hasTrainingConstraint: true,
        hasSafetyConstraint: false,
      },
    });
    const decision = buildTodayDecision(input({ state: travelState }));

    expect(decision.action).toBe("train_adapted");
    expect(decision.safetyConstraints).toContain("apply_persisted_execution_snapshot");
    expect(decision.evidence.at(-1)).toMatchObject({
      key: "active_life_context",
      value: "travel",
    });
  });

  it("uses several explicit negative outcomes only to lower the confidence label", () => {
    const feedbackState = DigitalAthleteStateSchema.parse({
      ...baseState,
      decisionFeedback: {
        available: true,
        ratedDecisionsLast28Days: 3,
        helpfulDecisionOutcomesLast28Days: 1,
        notHelpfulDecisionOutcomesLast28Days: 2,
        helpfulnessRate: 0.33,
      },
    });
    const decision = buildTodayDecision(input({ state: feedbackState }));

    expect(decision.action).toBe("train_as_planned");
    expect(decision.confidence).toBe(77);
    expect(decision.evidence).toContainEqual({
      key: "recent_decision_feedback",
      value: "1/3",
      sourceClass: "calculated",
      position: 3,
    });
  });

  it("keeps evidence capped when life context, rhythm, and feedback are all available", () => {
    const contextAndFeedbackState = DigitalAthleteStateSchema.parse({
      ...baseState,
      decisionFeedback: {
        available: true,
        ratedDecisionsLast28Days: 3,
        helpfulDecisionOutcomesLast28Days: 1,
        notHelpfulDecisionOutcomesLast28Days: 2,
        helpfulnessRate: 0.33,
      },
      currentContext: {
        active: [
          {
            id: "018f2e48-5e6d-7b8c-9d0e-1f2a3b4c5d71",
            content: "Temporary context: time_limited (30 min)",
            expiresAt: "2026-09-04T12:00:00.000Z",
            context: { kind: "time_limited", minutes: 30 },
          },
        ],
        shortestAvailableSessionMinutes: 30,
        hasTrainingConstraint: true,
        hasSafetyConstraint: false,
      },
    });
    const decision = buildTodayDecision(
      input({ state: contextAndFeedbackState, hasPreferredTrainingDayToday: true }),
    );

    expect(decision.evidence).toHaveLength(5);
    expect(decision.evidence.map((item) => item.key)).not.toContain("recent_decision_feedback");
    expect(decision.evidence).toContainEqual({
      key: "training_rhythm",
      value: "usual_training_day",
      sourceClass: "user_reported",
      position: 4,
    });
  });

  it("fingerprints an exact decision and snapshot deterministically", () => {
    const decision = buildTodayDecision(input());
    const snapshotId = "018f2e48-5e6d-7b8c-9d0e-1f2a3b4c5d6e";

    expect(fingerprintTodayDecision(decision, snapshotId)).toMatch(/^[a-f0-9]{64}$/);
    expect(fingerprintTodayDecision(decision, snapshotId)).toBe(
      fingerprintTodayDecision(decision, snapshotId),
    );
  });
});
