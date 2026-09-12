import type { AthleteHypothesis } from "./athlete-hypothesis.schema";
import type { LabHypothesisTransition } from "./lab.schema";

type AthleteHypothesisStatus = AthleteHypothesis["status"];

export type TwinMemoryChangeKind =
  "new" | "strengthened" | "weakened" | "contradicted" | "unchanged" | "unknown";

export type TwinMemoryChangeBasis =
  | "first_observation"
  | "status_transition"
  | "evidence_delta"
  | "no_change"
  | "baseline_unavailable";

export type TwinMemoryEvolution = {
  hypothesisId: string;
  kind: TwinMemoryChangeKind;
  basis: TwinMemoryChangeBasis;
  currentStatus: AthleteHypothesisStatus;
  previousStatus: AthleteHypothesisStatus | null;
  evidenceDelta: number | null;
  comparisonAvailable: boolean;
  occurredAt: string | null;
  athleteStateSnapshotId: string | null;
  source: "deterministic";
};

function statusStrength(status: AthleteHypothesisStatus): number {
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

function latestTransitionFor(
  hypothesisId: string,
  history: LabHypothesisTransition[],
): LabHypothesisTransition | null {
  return history.find((entry) => entry.hypothesisId === hypothesisId) ?? null;
}

export function evaluateTwinMemoryEvolution(
  hypothesis: AthleteHypothesis,
  history: LabHypothesisTransition[],
): TwinMemoryEvolution {
  const latest = latestTransitionFor(hypothesis.id, history);
  if (!latest) {
    return {
      hypothesisId: hypothesis.id,
      kind: "unknown",
      basis: "baseline_unavailable",
      currentStatus: hypothesis.status,
      previousStatus: null,
      evidenceDelta: null,
      comparisonAvailable: false,
      occurredAt: null,
      athleteStateSnapshotId: null,
      source: "deterministic",
    };
  }

  const evidenceDelta = hypothesis.evidenceCount - latest.evidenceCount;
  let previousStatus: AthleteHypothesisStatus | null = latest.status;

  let kind: TwinMemoryChangeKind = "unchanged";
  let basis: TwinMemoryChangeBasis = "no_change";
  if (hypothesis.status !== latest.status) {
    basis = "status_transition";
    kind =
      hypothesis.status === "contradicted"
        ? "contradicted"
        : statusStrength(hypothesis.status) > statusStrength(latest.status)
          ? "strengthened"
          : "weakened";
  } else if (evidenceDelta > 0) {
    basis = "evidence_delta";
    kind = "strengthened";
  } else if (evidenceDelta < 0) {
    basis = "evidence_delta";
    kind = "weakened";
  } else if (latest.previousStatus === null) {
    previousStatus = null;
    basis = "first_observation";
    kind = "new";
  } else if (latest.previousStatus !== latest.status) {
    previousStatus = latest.previousStatus;
    basis = "status_transition";
    kind =
      latest.status === "contradicted"
        ? "contradicted"
        : statusStrength(latest.status) > statusStrength(latest.previousStatus)
          ? "strengthened"
          : "weakened";
  }

  return {
    hypothesisId: hypothesis.id,
    kind,
    basis,
    currentStatus: hypothesis.status,
    previousStatus,
    evidenceDelta,
    comparisonAvailable: true,
    occurredAt: latest.occurredAt,
    athleteStateSnapshotId: latest.athleteStateSnapshotId,
    source: "deterministic",
  };
}

export function evaluateTwinMemoryEvolutionSet(
  hypotheses: AthleteHypothesis[],
  history: LabHypothesisTransition[],
): TwinMemoryEvolution[] {
  return hypotheses.map((hypothesis) => evaluateTwinMemoryEvolution(hypothesis, history));
}
