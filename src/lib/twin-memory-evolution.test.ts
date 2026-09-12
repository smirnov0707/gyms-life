import { describe, expect, it } from "vitest";
import type { AthleteHypothesis } from "./athlete-hypothesis.schema";
import type { LabHypothesisTransition } from "./lab.schema";
import { evaluateTwinMemoryEvolution } from "./twin-memory-evolution";

const hypothesis: AthleteHypothesis = {
  id: "fatigue",
  domain: "training_response",
  status: "monitoring",
  statementKey: "athlete.hypothesis.trainingResponse.repeatedLowFeeling",
  evidence: [],
  evidenceCount: 4,
  minimumEvidenceCount: 6,
  canInfluenceDecision: false,
};

function transition(overrides: Partial<LabHypothesisTransition> = {}): LabHypothesisTransition {
  return {
    hypothesisId: "fatigue",
    athleteStateSnapshotId: "11111111-1111-4111-8111-111111111111",
    domain: "training_response",
    previousStatus: "insufficient_evidence",
    status: "monitoring",
    statementKey: hypothesis.statementKey,
    evidence: [],
    evidenceCount: 3,
    minimumEvidenceCount: 6,
    canInfluenceDecision: false,
    source: "deterministic",
    occurredAt: "2026-09-10T08:00:00.000Z",
    ...overrides,
  };
}

describe("Twin Memory evolution", () => {
  it("keeps an unavailable baseline unknown instead of inventing no change", () => {
    expect(evaluateTwinMemoryEvolution(hypothesis, [])).toMatchObject({
      kind: "unknown",
      basis: "baseline_unavailable",
      comparisonAvailable: false,
      evidenceDelta: null,
    });
  });

  it("marks additional evidence in the same state as strengthened", () => {
    expect(evaluateTwinMemoryEvolution(hypothesis, [transition()])).toMatchObject({
      kind: "strengthened",
      basis: "evidence_delta",
      evidenceDelta: 1,
      previousStatus: "monitoring",
    });
  });

  it("marks a deterministic first observation as new", () => {
    expect(
      evaluateTwinMemoryEvolution({ ...hypothesis, evidenceCount: 3 }, [
        transition({ previousStatus: null }),
      ]),
    ).toMatchObject({ kind: "new", basis: "first_observation", comparisonAvailable: true });
  });

  it("keeps the latest status transition visible when current evidence matches its snapshot", () => {
    const result = evaluateTwinMemoryEvolution(
      { ...hypothesis, status: "supported", evidenceCount: 6, canInfluenceDecision: true },
      [
        transition({
          previousStatus: "monitoring",
          status: "supported",
          evidenceCount: 6,
          canInfluenceDecision: true,
        }),
      ],
    );
    expect(result).toMatchObject({
      kind: "strengthened",
      basis: "status_transition",
      previousStatus: "monitoring",
      currentStatus: "supported",
      evidenceDelta: 0,
    });
  });

  it("distinguishes contradiction from an ordinary weakening", () => {
    const result = evaluateTwinMemoryEvolution(
      { ...hypothesis, status: "contradicted", evidenceCount: 4 },
      [transition({ status: "monitoring", evidenceCount: 4 })],
    );
    expect(result.kind).toBe("contradicted");
  });

  it("retains immutable provenance for every comparable change", () => {
    const result = evaluateTwinMemoryEvolution(hypothesis, [transition()]);
    expect(result).toMatchObject({
      source: "deterministic",
      athleteStateSnapshotId: "11111111-1111-4111-8111-111111111111",
      occurredAt: "2026-09-10T08:00:00.000Z",
    });
  });
});
