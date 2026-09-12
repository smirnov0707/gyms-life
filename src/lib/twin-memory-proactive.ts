import type { TwinMemoryEvolution } from "./twin-memory-evolution";

export type TwinMemoryProactiveSignal = {
  fingerprint: string;
  hypothesisId: string;
  kind: "new" | "strengthened" | "weakened" | "contradicted";
  severity: "info" | "positive" | "attention";
  source: "deterministic";
  decisionAuthority: false;
  athleteStateSnapshotId: string;
};

/**
 * Proactive intelligence is intentionally stricter than the Twin Memory UI.
 * Evidence accumulation can be useful to inspect, but it must not generate a
 * notification after every session. Only auditable first observations and
 * status transitions are eligible for surfacing outside My Twin.
 */
export function buildTwinMemoryProactiveSignal(
  evolution: TwinMemoryEvolution,
): TwinMemoryProactiveSignal | null {
  if (
    !evolution.comparisonAvailable ||
    !evolution.athleteStateSnapshotId ||
    (evolution.basis !== "first_observation" && evolution.basis !== "status_transition") ||
    evolution.kind === "unchanged" ||
    evolution.kind === "unknown"
  )
    return null;

  const severity =
    evolution.kind === "contradicted" || evolution.kind === "weakened"
      ? "attention"
      : evolution.kind === "strengthened"
        ? "positive"
        : "info";

  return {
    fingerprint: [
      "twin-memory",
      evolution.hypothesisId,
      evolution.kind,
      evolution.athleteStateSnapshotId,
    ].join(":"),
    hypothesisId: evolution.hypothesisId,
    kind: evolution.kind,
    severity,
    source: "deterministic",
    decisionAuthority: false,
    athleteStateSnapshotId: evolution.athleteStateSnapshotId,
  };
}

export function buildTwinMemoryProactiveSignals(
  evolutions: TwinMemoryEvolution[],
): TwinMemoryProactiveSignal[] {
  return evolutions.flatMap((evolution) => {
    const signal = buildTwinMemoryProactiveSignal(evolution);
    return signal ? [signal] : [];
  });
}
