import type { AthleteHypothesis } from "./athlete-hypothesis.schema";
import type { LabHypothesisTransition } from "./lab.schema";

export type TwinLearningIntegrityStatus = "verified" | "unanchored" | "drift";
export type TwinLearningChainStatus = "continuous" | "broken" | "unknown";

export type TwinLearningIntegrityItem = {
  hypothesisId: string;
  currentStatus: AthleteHypothesis["status"];
  ledgerStatus: LabHypothesisTransition["status"] | null;
  latestOccurredAt: string | null;
  athleteStateSnapshotId: string | null;
  status: TwinLearningIntegrityStatus;
  chainStatus: TwinLearningChainStatus;
  definitionDrift: boolean;
  decisionAuthority: boolean;
};

export type TwinLearningIntegritySummary = {
  verified: number;
  unanchored: number;
  drift: number;
  decisionEligible: number;
  chainBreaks: number;
  definitionDrift: number;
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

function definitionDriftFor(
  hypothesis: AthleteHypothesis,
  transitions: readonly LabHypothesisTransition[],
): boolean {
  return transitions.some(
    (transition) =>
      transition.hypothesisId === hypothesis.id &&
      (transition.domain !== hypothesis.domain ||
        transition.statementKey !== hypothesis.statementKey),
  );
}

function chainStatusFor(
  hypothesisId: string,
  transitions: readonly LabHypothesisTransition[],
): TwinLearningChainStatus {
  const history = transitions
    .filter((transition) => transition.hypothesisId === hypothesisId)
    .slice()
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  if (history.length === 0) return "unknown";
  for (let index = 1; index < history.length; index += 1) {
    if (history[index]?.previousStatus !== history[index - 1]?.status) return "broken";
  }
  return "continuous";
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
    const chainStatus = chainStatusFor(hypothesis.id, transitions);
    const definitionDrift = definitionDriftFor(hypothesis, transitions);
    return {
      hypothesisId: hypothesis.id,
      currentStatus: hypothesis.status,
      ledgerStatus: latest?.status ?? null,
      latestOccurredAt: latest?.occurredAt ?? null,
      athleteStateSnapshotId: latest?.athleteStateSnapshotId ?? null,
      status,
      chainStatus,
      definitionDrift,
      decisionAuthority:
        hypothesis.canInfluenceDecision &&
        status === "verified" &&
        chainStatus !== "broken" &&
        !definitionDrift,
    };
  });
  const verified = items.filter((item) => item.status === "verified").length;
  const unanchored = items.filter((item) => item.status === "unanchored").length;
  const drift = items.filter((item) => item.status === "drift").length;
  const decisionEligible = items.filter((item) => item.decisionAuthority).length;
  const chainBreaks = items.filter((item) => item.chainStatus === "broken").length;
  const definitionDrift = items.filter((item) => item.definitionDrift).length;
  return {
    verified,
    unanchored,
    drift,
    decisionEligible,
    chainBreaks,
    definitionDrift,
    allVerified:
      items.length > 0 &&
      drift === 0 &&
      unanchored === 0 &&
      chainBreaks === 0 &&
      definitionDrift === 0,
    items,
  };
}
