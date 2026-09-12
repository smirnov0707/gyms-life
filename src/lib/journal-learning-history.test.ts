import { describe, expect, it } from "vitest";
import type { AthleteHypothesis } from "./athlete-hypothesis.schema";
import type { LabHypothesisTransition } from "./lab.schema";
import {
  buildJournalLearningHistory,
  summarizeJournalLearningWeek,
} from "./journal-learning-history";

const hypothesis: AthleteHypothesis = {
  id: "training-response-repeated-low-feeling",
  domain: "training_response",
  status: "supported",
  statementKey: "athlete.hypothesis.trainingResponse.repeatedLowFeeling",
  evidence: [],
  evidenceCount: 6,
  minimumEvidenceCount: 6,
  canInfluenceDecision: true,
};

function transition(
  previousStatus: LabHypothesisTransition["previousStatus"],
  status: LabHypothesisTransition["status"],
  evidenceCount: number,
  occurredAt: string,
): LabHypothesisTransition {
  return {
    hypothesisId: hypothesis.id,
    athleteStateSnapshotId: "00000000-0000-4000-8000-000000000099",
    domain: hypothesis.domain,
    previousStatus,
    status,
    statementKey: hypothesis.statementKey,
    evidence: [],
    evidenceCount,
    minimumEvidenceCount: 6,
    canInfluenceDecision: status === "supported",
    source: "deterministic",
    occurredAt,
  };
}

describe("journal learning history", () => {
  it("classifies first observation, strengthening and contradiction without inventing confidence", () => {
    const entries = buildJournalLearningHistory(
      [
        transition("monitoring", "supported", 6, "2026-09-12T10:00:00.000Z"),
        transition(null, "monitoring", 4, "2026-09-10T10:00:00.000Z"),
      ],
      [hypothesis],
    );
    expect(entries.map((entry) => entry.change)).toEqual(["strengthened", "first_observed"]);
    expect(entries[0]).toMatchObject({
      currentStatus: "supported",
      evidenceCount: 6,
      source: "deterministic",
      wasDecisionEligible: true,
      decisionAuthority: false,
    });
  });

  it("retains a past contradiction even when the current belief later recovered", () => {
    const entries = buildJournalLearningHistory(
      [transition("supported", "contradicted", 8, "2026-09-11T10:00:00.000Z")],
      [hypothesis],
    );
    expect(entries[0]).toMatchObject({
      change: "contradicted",
      status: "contradicted",
      currentStatus: "supported",
    });
  });
});

describe("weekly learning summary", () => {
  it("keeps only the last seven days and prioritizes epistemic reversals", () => {
    const entries = buildJournalLearningHistory(
      [
        transition("supported", "contradicted", 8, "2026-09-11T10:00:00.000Z"),
        transition("monitoring", "supported", 6, "2026-09-12T09:00:00.000Z"),
        transition(null, "monitoring", 4, "2026-09-01T09:00:00.000Z"),
      ],
      [hypothesis],
    );
    const summary = summarizeJournalLearningWeek(entries, new Date("2026-09-12T12:00:00.000Z"));
    expect(summary).toMatchObject({
      total: 2,
      firstObserved: 0,
      strengthened: 1,
      weakened: 0,
      contradicted: 1,
    });
    expect(summary.mostImportant?.change).toBe("contradicted");
  });
});
