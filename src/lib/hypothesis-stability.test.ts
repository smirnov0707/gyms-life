import { describe, expect, it } from "vitest";
import { summarizeHypothesisStability } from "./hypothesis-stability";
import type { LabHypothesisTransition } from "./lab.schema";

function transition(
  hypothesisId: string,
  occurredAt: string,
  previousStatus: LabHypothesisTransition["previousStatus"],
  status: LabHypothesisTransition["status"],
): LabHypothesisTransition {
  return {
    hypothesisId,
    athleteStateSnapshotId: "00000000-0000-4000-8000-000000000001",
    domain: "recovery",
    previousStatus,
    status,
    statementKey: "test.statement",
    evidence: [],
    evidenceCount: 1,
    minimumEvidenceCount: 1,
    canInfluenceDecision: status === "supported",
    source: "deterministic",
    occurredAt,
  };
}

describe("hypothesis stability retrospective", () => {
  it("treats one recorded state as stable", () => {
    const summary = summarizeHypothesisStability([
      transition("h1", "2026-09-01T00:00:00.000Z", null, "monitoring"),
    ]);
    expect(summary).toMatchObject({
      hypothesisCount: 1,
      transitionCount: 1,
      reversalCount: 0,
    });
    expect(summary.hypotheses[0]?.stability).toBe("stable");
  });

  it("distinguishes status change from supported/contradicted reversal", () => {
    const summary = summarizeHypothesisStability([
      transition("h1", "2026-09-03T00:00:00.000Z", "supported", "contradicted"),
      transition("h1", "2026-09-02T00:00:00.000Z", "monitoring", "supported"),
      transition("h1", "2026-09-01T00:00:00.000Z", null, "monitoring"),
      transition("h2", "2026-09-01T00:00:00.000Z", null, "monitoring"),
      transition("h2", "2026-09-02T00:00:00.000Z", "monitoring", "supported"),
    ]);
    expect(summary).toMatchObject({
      hypothesisCount: 2,
      transitionCount: 5,
      reversalCount: 1,
    });
    expect(summary.hypotheses.find((item) => item.hypothesisId === "h1")).toMatchObject({
      stability: "reversed",
      reversals: 1,
      latestStatus: "contradicted",
    });
    expect(summary.hypotheses.find((item) => item.hypothesisId === "h2")?.stability).toBe(
      "changed",
    );
  });
});
