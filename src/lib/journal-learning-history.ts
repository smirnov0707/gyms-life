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

export type JournalLearningWeekSummary = {
  total: number;
  firstObserved: number;
  strengthened: number;
  weakened: number;
  contradicted: number;
  mostImportant: JournalLearningEntry | null;
};

function weeklyPriority(change: JournalLearningChange): number {
  if (change === "contradicted") return 4;
  if (change === "weakened") return 3;
  if (change === "strengthened") return 2;
  return 1;
}

export function summarizeJournalLearningWeek(
  entries: readonly JournalLearningEntry[],
  now = new Date(),
): JournalLearningWeekSummary {
  const cutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const recent = entries
    .filter((entry) => {
      const occurred = Date.parse(entry.occurredAt);
      return occurred >= cutoff && occurred <= now.getTime();
    })
    .sort(
      (a, b) =>
        weeklyPriority(b.change) - weeklyPriority(a.change) ||
        b.occurredAt.localeCompare(a.occurredAt),
    );
  return {
    total: recent.length,
    firstObserved: recent.filter((entry) => entry.change === "first_observed").length,
    strengthened: recent.filter((entry) => entry.change === "strengthened").length,
    weakened: recent.filter((entry) => entry.change === "weakened").length,
    contradicted: recent.filter((entry) => entry.change === "contradicted").length,
    mostImportant: recent[0] ?? null,
  };
}
