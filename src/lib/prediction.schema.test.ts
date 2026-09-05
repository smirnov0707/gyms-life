import { describe, expect, it } from "vitest";
import { AthletePredictionSchema, SimulationScenarioSchema } from "./prediction.schema";

const basePrediction = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  target: "workout_completion" as const,
  generatedAt: "2026-09-05T06:00:00+03:00",
  horizonEndsAt: "2026-09-05T22:00:00+03:00",
  modelId: "behavioral-baseline",
  modelVersion: "0.1.0",
  maturity: "shadow" as const,
  athleteStateSnapshotId: null,
  evidenceLevel: "early" as const,
  evidence: [],
  predicted: { kind: "probability" as const, value: 0.7 },
  actual: null,
  evaluatedAt: null,
};

describe("AthletePredictionSchema", () => {
  it("accepts a bounded shadow prediction", () => {
    expect(AthletePredictionSchema.parse(basePrediction).target).toBe("workout_completion");
  });

  it("preserves typed temporal provenance for supporting evidence", () => {
    const parsed = AthletePredictionSchema.parse({
      ...basePrediction,
      evidence: [{
        sourceType: "workout_session",
        sourceId: "session-1",
        provenance: "measured",
        occurredAt: "2026-09-04T18:00:00+03:00",
        recordedAt: "2026-09-04T18:02:00+03:00",
        timezone: "Europe/Vilnius",
        quality: "available",
      }],
    });
    expect(parsed.evidence[0]?.provenance).toBe("measured");
  });

  it("rejects a horizon that is not in the future", () => {
    expect(() => AthletePredictionSchema.parse({ ...basePrediction, horizonEndsAt: basePrediction.generatedAt })).toThrow();
  });

  it("rejects probability outside zero to one", () => {
    expect(() => AthletePredictionSchema.parse({ ...basePrediction, predicted: { kind: "probability", value: 1.2 } })).toThrow();
  });

  it("requires actual outcome and evaluation time together", () => {
    expect(() => AthletePredictionSchema.parse({ ...basePrediction, evaluatedAt: "2026-09-05T22:01:00+03:00" })).toThrow();
    expect(() => AthletePredictionSchema.parse({ ...basePrediction, actual: { kind: "boolean", value: true } })).toThrow();
  });

  it("requires workout completion actual outcomes to be boolean", () => {
    expect(() => AthletePredictionSchema.parse({
      ...basePrediction,
      actual: { kind: "category", value: "completed" },
      evaluatedAt: "2026-09-05T22:01:00+03:00",
    })).toThrow();
  });
});

describe("SimulationScenarioSchema", () => {
  it("keeps a counterfactual scenario explicitly separate from a prediction", () => {
    const scenario = SimulationScenarioSchema.parse({
      id: "550e8400-e29b-41d4-a716-446655440001",
      generatedAt: "2026-09-05T06:00:00+03:00",
      horizonEndsAt: "2026-12-05T06:00:00+02:00",
      scenarioKey: "four_sessions_weekly",
      assumptions: ["Four planned training sessions per week"],
      modelId: "future-me-baseline",
      modelVersion: "0.1.0",
      outputs: { adherence: { kind: "probability", value: 0.8 } },
      evidenceLevel: "early",
    });
    expect(scenario.scenarioKey).toBe("four_sessions_weekly");
    expect("target" in scenario).toBe(false);
  });
});
