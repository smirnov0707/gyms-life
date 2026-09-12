import { describe, expect, it } from "vitest";
import type { LabOverview } from "./lab.schema";
import { buildTwinUncertaintyMap } from "./twin-uncertainty-map";

function lab(): LabOverview {
  return {
    hypotheses: [
      {
        id: "h1",
        domain: "training_response",
        status: "insufficient_evidence",
        statementKey: "athlete.hypothesis.trainingResponse.repeatedLowFeeling",
        evidence: [],
        evidenceCount: 2,
        minimumEvidenceCount: 6,
        canInfluenceDecision: false,
      },
      {
        id: "h2",
        domain: "training_behavior",
        status: "monitoring",
        statementKey: "athlete.hypothesis.trainingBehavior.usualDayFit",
        evidence: [],
        evidenceCount: 8,
        minimumEvidenceCount: 8,
        canInfluenceDecision: false,
      },
    ],
    hypothesisHistory: [],
    decisions: [],
    decisionAccuracy: {
      totalProposed: 0,
      totalAnswered: 0,
      totalFitting: 0,
      overallFitRate: null,
      minimumAnswered: 3,
      byBasis: [],
    },
    predictionCalibration: {
      target: "workout_completion",
      maturity: "shadow",
      totalCaptured: 0,
      totalEvaluated: 0,
      totalPending: 0,
      minimumEvaluated: 5,
      models: [],
    },
    proactiveMemoryChanges: [],
    dataGaps: ["no_recovery_checkins_7d", "nutrition_data_unavailable"],
    unreadable: ["decisions"],
  };
}

describe("Twin uncertainty map", () => {
  it("separates active learning, actionable gaps and unavailable sources", () => {
    expect(buildTwinUncertaintyMap(lab())).toEqual({
      activeLearning: 2,
      actionableEvidenceGaps: 1,
      unavailableSources: 2,
      decisionAuthority: false,
    });
  });

  it("does not invent uncertainty when Lab is unavailable", () => {
    expect(buildTwinUncertaintyMap(null)).toEqual({
      activeLearning: 0,
      actionableEvidenceGaps: 0,
      unavailableSources: 0,
      decisionAuthority: false,
    });
  });
});
