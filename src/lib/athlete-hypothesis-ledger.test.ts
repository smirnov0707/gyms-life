import { describe, expect, it } from "vitest";
import type { AthleteHypothesis } from "./athlete-hypothesis.schema";
import {
  buildHypothesisLedgerTransitions,
  latestHypothesisLedgerState,
  type AthleteHypothesisLedgerSummary,
} from "./athlete-hypothesis-ledger";

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
): AthleteHypothesisLedgerSummary {
  return {
    hypothesisId: hypothesis.id,
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
  it("records the first observed state", () => {
    expect(buildHypothesisLedgerTransitions([hypothesis], [])).toEqual([
      {
        hypothesisId: hypothesis.id,
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
    expect(buildHypothesisLedgerTransitions([current], [ledgerEntry("monitoring", 4)])).toEqual(
      [],
    );
  });

  it("records a real status transition with the prior state", () => {
    const current = {
      ...hypothesis,
      status: "supported",
      evidenceCount: 6,
      canInfluenceDecision: true,
    } satisfies AthleteHypothesis;

    expect(buildHypothesisLedgerTransitions([current], [ledgerEntry("monitoring", 5)])).toEqual([
      expect.objectContaining({
        hypothesisId: hypothesis.id,
        previousStatus: "monitoring",
        status: "supported",
        evidenceCount: 6,
        canInfluenceDecision: true,
      }),
    ]);
  });

  it("uses the first newest-first entry as the latest state", () => {
    const newest = ledgerEntry("supported", 6, "monitoring");
    const older = ledgerEntry("monitoring", 5, null);
    expect(latestHypothesisLedgerState([newest, older]).get(hypothesis.id)).toEqual(newest);
  });
});
