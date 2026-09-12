import type { AthleteHypothesis } from "./athlete-hypothesis.schema";
import type { LabHypothesisTransition } from "./lab.schema";

export type TwinLearningIntegrityStatus = "verified" | "unanchored" | "drift";

export type TwinLearningIntegrityItem = {
  hypothesisId: string;
  currentStatus: AthleteHypothesis["status"];
  ledgerStatus: LabHypothesisTransition["status"] | null;
  latestOccurredAt: string | null;
  athleteStateSnapshotId: string | null;
  status: TwinLearningIntegrityStatus;
};

export type TwinLearningIntegritySummary = {
  verified: number;
  unanchored: number;
  drift: number;
  allVerified: boolean;
  items: TwinLearningIntegrityItem[];
};
function latestTransitionFor(
  hypothesisId: string,
  transitions: readonly LabHypothesisTransition[],
): LabHypothesisTransition | null {
  let latest: LabHypothesisTransition | null = null;
  for (const transition of transitions) {
    if (transition.hypothesisId !== hypothesisId) continue;
    if (!latest || transition.occurredAt > latest.occurredAt) latest = transition;
  }
  return latest;
}

export function evaluateTwinLearningIntegrity(
  hypotheses: readonly AthleteHypothesis[],
  transitions: readonly LabHypothesisTransition[],
): TwinLearningIntegritySummary {
  const items = hypotheses.map((hypothesis): TwinLearningIntegrityItem => {
    const latest = latestTransitionFor(hypothesis.id, transitions);
    const status: TwinLearningIntegrityStatus = !latest
      ? "unanchored"
      : latest.status === hypothesis.status
        ? "verified"
        : "drift";
    return {
      hypothesisId: hypothesis.id,
      currentStatus: hypothesis.status,
      ledgerStatus: latest?.status ?? null,
      latestOccurredAt: latest?.occurredAt ?? null,
      athleteStateSnapshotId: latest?.athleteStateSnapshotId ?? null,
      status,
    };
  });
  const verified = items.filter((item) => item.status === "verified").length;
  const unanchored = items.filter((item) => item.status === "unanchored").length;
  const drift = items.filter((item) => item.status === "drift").length;
  return {
    verified,
    unanchored,
    drift,
    allVerified: items.length > 0 && drift === 0 && unanchored === 0,
    items,
  };
}
