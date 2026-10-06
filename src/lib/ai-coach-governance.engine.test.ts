import { describe, expect, it } from "vitest";
import { governCoachRecommendation } from "./ai-coach-governance.engine";
import type { CoachContext, CoachRecommendation } from "./ai-coach.contract";

const context = {
  endurance: {
    active: true,
    readiness: "on_track",
    adaptation: { action: "hold", volumeModifier: 1, reason: "on_track" },
    postRun: null,
    prohibitedClaims: [
      "diagnosis",
      "injury_prediction_without_evidence",
      "guaranteed_race_time",
      "vo2max_without_measurement",
      "override_deterministic_training_decision",
    ],
  },
} as CoachContext;

const recommendation = (
  actions: CoachRecommendation["actions"],
  summary = "Keep going",
): CoachRecommendation => ({
  schemaVersion: "1.0",
  decision: "ADJUST_NEXT_WORKOUT",
  priority: "MEDIUM",
  summary,
  rationale: [],
  actions,
  confidence: 0.8,
  safety: { requiresUserConfirmation: false, notes: [] },
});

describe("coach governance", () => {
  it("blocks generic endurance load increase", () => {
    expect(
      governCoachRecommendation(
        context,
        recommendation([
          {
            type: "INCREASE_LOAD",
            exerciseSlug: null,
            value: 20,
            unit: "percent",
            instruction: "Add 20%",
          },
        ]),
      ).enduranceExecution,
    ).toBe("blocked");
  });

  it("does not block a clearly strength-specific load action", () => {
    expect(
      governCoachRecommendation(
        context,
        recommendation([
          {
            type: "INCREASE_LOAD",
            exerciseSlug: "bench-press",
            value: 2.5,
            unit: "kg",
            instruction: "Add 2.5 kg to bench press.",
          },
        ]),
      ).enduranceExecution,
    ).toBe("allowed");
  });

  it("blocks keep-plan while deterministic recovery is governing", () => {
    const recoveryContext: CoachContext = {
      ...context,
      endurance: {
        ...context.endurance,
        adaptation: {
          action: "recover",
          volumeModifier: 0.7,
          reason: "low_readiness_and_missed_work",
        },
      },
    };
    expect(
      governCoachRecommendation(
        recoveryContext,
        recommendation([
          {
            type: "KEEP_PLAN",
            exerciseSlug: null,
            value: null,
            unit: null,
            instruction: "Keep the run plan.",
          },
        ]),
      ).violations,
    ).toContain("deterministic_recovery_guard_conflict");
  });

  it("allows explanatory recovery action", () => {
    expect(
      governCoachRecommendation(
        context,
        recommendation([
          {
            type: "RECOVER",
            exerciseSlug: null,
            value: null,
            unit: null,
            instruction: "Recover.",
          },
        ]),
      ).enduranceExecution,
    ).toBe("allowed");
  });
});
