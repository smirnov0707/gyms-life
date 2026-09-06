import { describe, expect, it } from "vitest";
import type { AthleteHypothesis } from "./athlete-hypothesis.schema";
import {
  buildHypothesisLedgerTransitions,
  latestHypothesisLedgerState,
  type AthleteHypothesisLedgerSummary,
} from "./athlete-hypothesis-ledger";

const SNAPSHOT_A = "00000000-0000-4000-8000-000000000010";
const SNAPSHOT_B = "00000000-0000-4000-8000-000000000011";

const hypothesis: AthleteHypothesis = {
  id: "training-response-repeated-low-feeling",
  domain: "training_response",
  status: "monitoring",
  statementKey: "athlete.hypothesis.trainingResponse.repeatedLowFeeling",
  evidence: [
    {
      key: "rated_sessions_28d",
      value: 4,
      unit: "sessions",
      source: "user_reported",
    },
  ],
  evidenceCount: 4,
  minimumEvidenceCount: 6,
  canInfluenceDecision: false,
};

function ledgerEntry(
  status: AthleteHypothesisLedgerSummary["status"],
  evidenceCount: number,
  previousStatus: AthleteHypothesisLedgerSummary["previousStatus"] = null,
  athleteStateSnapshotId = SNAPSHOT_A,
): AthleteHypothesisLedgerSummary {
  return {
    hypothesisId: hypothesis.id,
    athleteStateSnapshotId,
    domain: hypothesis.domain,
    previousStatus,
    status,
    statementKey: hypothesis.statementKey,
    evidence: hypothesis.evidence,
    evidenceCount,
    minimumEvidenceCount: hypothesis.minimumEvidenceCount,
    canInfluenceDecision: status === "supported",
    source: "deterministic",
  };
}

describe("hypothesis ledger transitions", () => {
  it("records the first observed state against the producing snapshot", () => {
    expect(buildHypothesisLedgerTransitions([hypothesis], [], SNAPSHOT_B)).toEqual([
      {
        hypothesisId: hypothesis.id,
        athleteStateSnapshotId: SNAPSHOT_B,
        domain: "training_response",
        previousStatus: null,
        status: "monitoring",
        statementKey: hypothesis.statementKey,
        evidence: hypothesis.evidence,
        evidenceCount: 4,
        minimumEvidenceCount: 6,
        canInfluenceDecision: false,
        source: "deterministic",
      },
    ]);
  });

  it("does not create timeline noise when evidence changes without a status change", () => {
    const current = { ...hypothesis, evidenceCount: 5 } satisfies AthleteHypothesis;
    expect(
      buildHypothesisLedgerTransitions([current], [ledgerEntry("monitoring", 4)], SNAPSHOT_B),
    ).toEqual([]);
  });

  it("records a real status transition with the prior state and new snapshot", () => {
    const current = {
      ...hypothesis,
      status: "supported",
      evidenceCount: 6,
      canInfluenceDecision: true,
    } satisfies AthleteHypothesis;

    expect(
      buildHypothesisLedgerTransitions([current], [ledgerEntry("monitoring", 5)], SNAPSHOT_B),
    ).toEqual([
      expect.objectContaining({
        hypothesisId: hypothesis.id,
        athleteStateSnapshotId: SNAPSHOT_B,
        previousStatus: "monitoring",
        status: "supported",
        evidenceCount: 6,
        canInfluenceDecision: true,
      }),
    ]);
  });

  it("uses the first newest-first entry as the latest state", () => {
    const newest = ledgerEntry("supported", 6, "monitoring", SNAPSHOT_B);
    const older = ledgerEntry("monitoring", 5, null, SNAPSHOT_A);
    expect(latestHypothesisLedgerState([newest, older]).get(hypothesis.id)).toEqual(newest);
  });

  it("rejects a transition that is not anchored to a valid snapshot id", () => {
    expect(() => buildHypothesisLedgerTransitions([hypothesis], [], "not-a-uuid")).toThrow();
  });
});
