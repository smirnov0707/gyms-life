import { describe, expect, it } from "vitest";
import { runCoachWorker } from "./ai-coach.worker";
import type { CoachContext } from "./ai-coach.contract";

const context: CoachContext = {
  schemaVersion: "1.3",
  user: { id: "00000000-0000-4000-8000-000000000001" },
  generatedAt: "2026-09-01T00:00:00.000Z",
  goal: "strength",
  activePlan: null,
  performance: { workouts: 1, totalVolumeKg: 100, totalSets: 3, totalReps: 30, averageRpe: 7 },
  performanceSignals: [],
  endurance: {
    active: false,
    raceDistance: null,
    daysToRace: null,
    phase: null,
    readiness: null,
    evidenceLevel: null,
    adaptation: null,
    nextSession: null,
    postRun: null,
    prohibitedClaims: [
      "diagnosis",
      "injury_prediction_without_evidence",
      "guaranteed_race_time",
      "vo2max_without_measurement",
      "override_deterministic_training_decision",
    ],
  },
  exercises: [],
};

describe("runCoachWorker", () => {
  it("validates a worker recommendation at the boundary", async () => {
    const result = await runCoachWorker(
      {
        name: "fake",
        version: "test",
        async generateRecommendation() {
          return {
            schemaVersion: "1.0",
            decision: "NO_CHANGE",
            priority: "LOW",
            summary: "Keep plan",
            rationale: ["Stable performance"],
            actions: [
              {
                type: "KEEP_PLAN",
                exerciseSlug: null,
                value: null,
                unit: null,
                instruction: "Continue the current plan.",
              },
            ],
            confidence: 0.9,
            safety: { requiresUserConfirmation: true, notes: [] },
          };
        },
      },
      context,
    );
    expect(result.decision).toBe("NO_CHANGE");
  });

  it("blocks provider endurance load override at the worker boundary", async () => {
    const enduranceContext: CoachContext = {
      ...context,
      endurance: {
        ...context.endurance,
        active: true,
        raceDistance: "10k",
        daysToRace: 30,
        phase: "build",
        readiness: "on_track",
        evidenceLevel: "moderate",
      },
    };

    const result = await runCoachWorker(
      {
        name: "fake",
        version: "test",
        async generateRecommendation() {
          return {
            schemaVersion: "1.0",
            decision: "ADJUST_NEXT_WORKOUT",
            priority: "MEDIUM",
            summary: "Add more",
            rationale: [],
            actions: [
              {
                type: "INCREASE_LOAD",
                exerciseSlug: null,
                value: 20,
                unit: "percent",
                instruction: "Add 20%",
              },
            ],
            confidence: 0.9,
            safety: { requiresUserConfirmation: false, notes: [] },
          };
        },
      },
      enduranceContext,
    );

    expect(result.decision).toBe("NO_CHANGE");
    expect(result.actions[0]?.type).toBe("KEEP_PLAN");
  });
});
