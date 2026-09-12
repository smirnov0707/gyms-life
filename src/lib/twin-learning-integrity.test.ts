import { describe, expect, it } from "vitest";
import type { AthleteHypothesis } from "./athlete-hypothesis.schema";
import type { LabHypothesisTransition } from "./lab.schema";
import { evaluateTwinLearningIntegrity } from "./twin-learning-integrity";

function hypothesis(id: string, status: AthleteHypothesis["status"]): AthleteHypothesis {
  return {
    id,
    domain: "training_response",
    status,
    statementKey: "athlete.hypothesis.trainingResponse.repeatedLowFeeling",
    evidence: [],
    evidenceCount: 6,
    minimumEvidenceCount: 6,
    canInfluenceDecision: status === "supported",
  };
}

function transition(
  id: string,
  status: LabHypothesisTransition["status"],
  occurredAt: string,
): LabHypothesisTransition {
  return {
    hypothesisId: id,
    athleteStateSnapshotId: "00000000-0000-4000-8000-000000000099",
    domain: "training_response",
    previousStatus: null,
    status,
    statementKey: "athlete.hypothesis.trainingResponse.repeatedLowFeeling",
    evidence: [],
    evidenceCount: 6,
    minimumEvidenceCount: 6,
    canInfluenceDecision: status === "supported",
    source: "deterministic",
    occurredAt,
  };
}

describe("Twin learning integrity", () => {
  it("verifies a current belief against the latest ledger transition", () => {
    const result = evaluateTwinLearningIntegrity(
      [hypothesis("h1", "supported")],
      [
        transition("h1", "monitoring", "2026-09-10T10:00:00.000Z"),
        transition("h1", "supported", "2026-09-12T10:00:00.000Z"),
      ],
    );
    expect(result).toMatchObject({ verified: 1, unanchored: 0, drift: 0, allVerified: true });
    expect(result.items[0]?.status).toBe("verified");
  });
  it("marks missing history as unanchored rather than verified", () => {
    const result = evaluateTwinLearningIntegrity([hypothesis("h1", "monitoring")], []);
    expect(result).toMatchObject({ verified: 0, unanchored: 1, drift: 0, allVerified: false });
    expect(result.items[0]?.ledgerStatus).toBeNull();
  });

  it("detects drift when current belief differs from the latest auditable status", () => {
    const result = evaluateTwinLearningIntegrity(
      [hypothesis("h1", "supported")],
      [transition("h1", "contradicted", "2026-09-12T10:00:00.000Z")],
    );
    expect(result).toMatchObject({ verified: 0, unanchored: 0, drift: 1, allVerified: false });
    expect(result.items[0]).toMatchObject({
      status: "drift",
      currentStatus: "supported",
      ledgerStatus: "contradicted",
    });
  });
});
