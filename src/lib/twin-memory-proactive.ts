import { z } from "zod";
import type { AthleteHypothesisLedgerSummary } from "./athlete-hypothesis-ledger";
import type { TwinMemoryEvolution } from "./twin-memory-evolution";

export const TwinMemoryProactiveSignalSchema = z
  .object({
    fingerprint: z.string().min(1).max(300),
    hypothesisId: z.string().min(1).max(120),
    kind: z.enum(["new", "strengthened", "weakened", "contradicted"]),
    severity: z.enum(["info", "positive", "attention"]),
    source: z.literal("deterministic"),
    decisionAuthority: z.literal(false),
    athleteStateSnapshotId: z.string().uuid(),
  })
  .strict();

export type TwinMemoryProactiveSignal = z.infer<typeof TwinMemoryProactiveSignalSchema>;

export const TwinMemoryProactiveStatusSchema = z.enum(["new", "seen", "dismissed"]);
export type TwinMemoryProactiveStatus = z.infer<typeof TwinMemoryProactiveStatusSchema>;

export const TwinMemoryProactiveLifecycleActionSchema = z.enum(["seen", "dismissed"]);
export type TwinMemoryProactiveLifecycleAction = z.infer<
  typeof TwinMemoryProactiveLifecycleActionSchema
>;

export const TwinMemoryProactiveLifecycleEventSchema = z
  .object({
    fingerprint: z.string().min(1).max(300),
    action: TwinMemoryProactiveLifecycleActionSchema,
    source: z.literal("deterministic"),
    decisionAuthority: z.literal(false),
  })
  .strict();

export type TwinMemoryProactiveLifecycleEvent = z.infer<
  typeof TwinMemoryProactiveLifecycleEventSchema
>;

export const TwinMemoryProactiveRecordSchema = TwinMemoryProactiveSignalSchema.extend({
  occurredAt: z.string().datetime({ offset: true }),
  status: TwinMemoryProactiveStatusSchema,
  statusChangedAt: z.string().datetime({ offset: true }).nullable(),
}).strict();

export type TwinMemoryProactiveRecord = z.infer<typeof TwinMemoryProactiveRecordSchema>;

export function nextTwinMemoryProactiveStatus(
  current: TwinMemoryProactiveStatus,
  action: TwinMemoryProactiveLifecycleAction,
): TwinMemoryProactiveStatus {
  if (current === "dismissed") return "dismissed";
  if (action === "dismissed") return "dismissed";
  return "seen";
}

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

function transitionStrength(status: AthleteHypothesisLedgerSummary["status"]): number {
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

export function buildTwinMemoryProactiveSignalFromTransition(
  transition: AthleteHypothesisLedgerSummary,
): TwinMemoryProactiveSignal {
  const kind =
    transition.previousStatus === null
      ? "new"
      : transition.status === "contradicted"
        ? "contradicted"
        : transitionStrength(transition.status) > transitionStrength(transition.previousStatus)
          ? "strengthened"
          : "weakened";
  const severity =
    kind === "contradicted" || kind === "weakened"
      ? "attention"
      : kind === "strengthened"
        ? "positive"
        : "info";
  return TwinMemoryProactiveSignalSchema.parse({
    fingerprint: [
      "twin-memory",
      transition.hypothesisId,
      kind,
      transition.athleteStateSnapshotId,
    ].join(":"),
    hypothesisId: transition.hypothesisId,
    kind,
    severity,
    source: "deterministic",
    decisionAuthority: false,
    athleteStateSnapshotId: transition.athleteStateSnapshotId,
  });
}

function proactivePriority(record: TwinMemoryProactiveRecord): number {
  if (record.status !== "new") return -1;
  if (record.kind === "contradicted") return 4;
  if (record.kind === "weakened") return 3;
  if (record.kind === "strengthened") return 2;
  return 1;
}

export function selectTwinMemoryProactiveChange(
  records: readonly TwinMemoryProactiveRecord[],
): TwinMemoryProactiveRecord | null {
  return (
    [...records]
      .filter((record) => record.status === "new")
      .sort((a, b) => {
        const priorityDelta = proactivePriority(b) - proactivePriority(a);
        if (priorityDelta !== 0) return priorityDelta;
        return b.occurredAt.localeCompare(a.occurredAt);
      })[0] ?? null
  );
}
