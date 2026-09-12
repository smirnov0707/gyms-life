import { describe, expect, it } from "vitest";
import { LabOverviewSchema } from "./lab.schema";
import { DeterministicPerformanceForecastSchema } from "./forecast.schema";
import { buildTwinEpistemicState } from "./twin-epistemic-state";

const hypothesis = {
  id: "h1",
  domain: "training_response" as const,
  status: "monitoring" as const,
  statementKey: "athlete.hypothesis.test",
  evidence: [],
  evidenceCount: 2,
  minimumEvidenceCount: 4,
  canInfluenceDecision: false,
};

function labOverview() {
  return LabOverviewSchema.parse({
    hypotheses: [hypothesis],
    hypothesisHistory: [],
    decisions: [],
    decisionAccuracy: {
      totalProposed: 3,
      totalAnswered: 2,
      totalFitting: 1,
      overallFitRate: null,
      minimumAnswered: 3,
      byBasis: [],
    },
    predictionCalibration: {
      target: "workout_completion",
      maturity: "shadow",
      totalCaptured: 2,
      totalEvaluated: 1,
      totalPending: 1,
      minimumEvaluated: 8,
      models: [
        {
          modelId: "completion",
          modelVersion: "1.0",
          captured: 2,
          evaluated: 1,
          pending: 1,
          minimumEvaluated: 8,
          meanPredictedProbability: null,
          observedCompletionRate: null,
          calibrationGap: null,
          brierScore: null,
        },
      ],
    },
    dataGaps: ["no_recovery_checkins_7d"],
    unreadable: [],
  });
}

function forecast() {
  return DeterministicPerformanceForecastSchema.parse({
    status: "ready",
    forecastVersion: "1.0",
    sourceWindowDays: 120,
    lifts: [
      {
        exerciseSlug: "bench-press",
        exerciseName: "Bench Press",
        currentEstimated1RMKg: 100,
        projected4WeeksEstimated1RMKg: 102,
        projected12WeeksEstimated1RMKg: 104,
        trend: "rising",
        evidenceStrength: "moderate",
        evidence: {
          sessionCount: 8,
          weeksTracked: 6,
          spanDays: 60,
          averageRpe: 8,
          observedWeeklyChangeKg: 1,
        },
      },
    ],
  });
}
describe("Twin epistemic state", () => {
  it("keeps hypotheses, predictions and unknowns in separate buckets", () => {
    const state = buildTwinEpistemicState(labOverview(), forecast());
    expect(state.observed).toEqual({ answeredDecisions: 2, evaluatedPredictionOutcomes: 1 });
    expect(state.hypotheses).toMatchObject({ monitoring: 1, supported: 0 });
    expect(state.prediction).toMatchObject({
      state: "shadow_uncalibrated",
      calibratedModelCount: 0,
      reviewEligibleModelCount: 0,
      forecastLiftCount: 1,
      forecastEvidence: { low: 0, moderate: 1, high: 0 },
    });
    expect(state.unknowns).toEqual({ dataGapCount: 1, unreadableSourceCount: 0 });
  });

  it("never promotes shadow predictions or unsupported hypotheses into Today authority", () => {
    const state = buildTwinEpistemicState(labOverview(), forecast());
    expect(state.guardrails).toEqual({
      shadowPredictionInfluencesToday: false,
      futureMeForecastInfluencesToday: false,
      unsupportedHypothesisInfluencesToday: false,
    });
  });

  it("returns unavailable prediction state when Lab data cannot be read", () => {
    expect(buildTwinEpistemicState(null, null).prediction.state).toBe("unavailable");
  });
});
