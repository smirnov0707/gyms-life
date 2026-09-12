import { z } from "zod";
import type { AthleteHypothesis } from "./athlete-hypothesis.schema";
import type { LabHypothesisTransition } from "./lab.schema";

export const JournalLearningChangeSchema = z.enum([
  "first_observed",
  "strengthened",
  "weakened",
  "contradicted",
]);
export type JournalLearningChange = z.infer<typeof JournalLearningChangeSchema>;

export type JournalLearningEntry = {
  hypothesisId: string;
  statementKey: string;
  change: JournalLearningChange;
  previousStatus: LabHypothesisTransition["previousStatus"];
  status: LabHypothesisTransition["status"];
  currentStatus: AthleteHypothesis["status"] | null;
  evidenceCount: number;
  minimumEvidenceCount: number;
  occurredAt: string;
  athleteStateSnapshotId: string;
  source: "deterministic";
  decisionAuthority: false;
};
function strength(status: LabHypothesisTransition["status"]): number {
  switch (status) {
    case "contradicted":
      return 0;
    case "insufficient_evidence":
      return 1;
    case "monitoring":
      return 2;
    case "supported":
      return 3;
  }
}

function classify(transition: LabHypothesisTransition): JournalLearningChange {
  if (transition.previousStatus === null) return "first_observed";
  if (transition.status === "contradicted") return "contradicted";
  return strength(transition.status) > strength(transition.previousStatus)
    ? "strengthened"
    : "weakened";
}

export function buildJournalLearningHistory(
  transitions: readonly LabHypothesisTransition[],
  hypotheses: readonly AthleteHypothesis[],
): JournalLearningEntry[] {
  const currentById = new Map(hypotheses.map((item) => [item.id, item.status] as const));
  return transitions.map((transition) => ({
    hypothesisId: transition.hypothesisId,
    statementKey: transition.statementKey,
    change: classify(transition),
    previousStatus: transition.previousStatus,
    status: transition.status,
    currentStatus: currentById.get(transition.hypothesisId) ?? null,
    evidenceCount: transition.evidenceCount,
    minimumEvidenceCount: transition.minimumEvidenceCount,
    occurredAt: transition.occurredAt,
    athleteStateSnapshotId: transition.athleteStateSnapshotId,
    source: "deterministic",
    decisionAuthority: false,
  }));
}
