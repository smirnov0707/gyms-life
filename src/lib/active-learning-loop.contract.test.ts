import { describe, expect, it } from "vitest";
import type { AthleteHypothesis } from "./athlete-hypothesis.schema";
import { buildHypothesisLedgerTransitions } from "./athlete-hypothesis-ledger";
import { selectEvidenceAcquisitionRecommendation } from "./evidence-acquisition";
import { buildTwinMemoryProactiveSignalFromTransition } from "./twin-memory-proactive";

const SNAPSHOT_A = "00000000-0000-4000-8000-000000000021";
const SNAPSHOT_B = "00000000-0000-4000-8000-000000000022";

function hypothesis(evidenceCount: number, status: AthleteHypothesis["status"]): AthleteHypothesis {
  return {
    id: "training-response-repeated-low-feeling",
    domain: "training_response",
    status,
    statementKey: "athlete.hypothesis.trainingResponse.repeatedLowFeeling",
    evidence: [
      {
        key: "rated_sessions_28d",
        value: evidenceCount,
        unit: "sessions",
        source: "user_reported",
      },
    ],
    evidenceCount,
    minimumEvidenceCount: 6,
    canInfluenceDecision: status === "supported",
  };
}
describe("active learning loop contract", () => {
  it("reduces remaining evidence one observation at a time", () => {
    expect(
      selectEvidenceAcquisitionRecommendation([hypothesis(4, "insufficient_evidence")], []),
    ).toMatchObject({
      action: "rate_next_workout",
      evidenceRemaining: 2,
      decisionAuthority: false,
    });
    expect(
      selectEvidenceAcquisitionRecommendation([hypothesis(5, "insufficient_evidence")], []),
    ).toMatchObject({
      action: "rate_next_workout",
      evidenceRemaining: 1,
      decisionAuthority: false,
    });
  });

  it("closes acquisition when the threshold becomes a material status transition", () => {
    const baseline = buildHypothesisLedgerTransitions(
      [hypothesis(5, "insufficient_evidence")],
      [],
      SNAPSHOT_A,
    );
    const resolved = hypothesis(6, "supported");
    expect(selectEvidenceAcquisitionRecommendation([resolved], [])).toBeNull();
    const transitions = buildHypothesisLedgerTransitions([resolved], baseline, SNAPSHOT_B);
    expect(transitions).toHaveLength(1);
    expect(transitions[0]).toMatchObject({
      previousStatus: "insufficient_evidence",
      status: "supported",
      evidenceCount: 6,
    });
    const proactive = buildTwinMemoryProactiveSignalFromTransition(transitions[0]!);
    expect(proactive).toMatchObject({
      kind: "strengthened",
      severity: "positive",
      decisionAuthority: false,
      athleteStateSnapshotId: SNAPSHOT_B,
    });
  });
});
