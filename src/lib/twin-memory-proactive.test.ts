import { describe, expect, it } from "vitest";
import type { TwinMemoryEvolution } from "./twin-memory-evolution";
import {
  buildTwinMemoryProactiveSignal,
  buildTwinMemoryProactiveSignalFromTransition,
  rankTwinMemoryProactiveChanges,
  selectTwinMemoryProactiveChange,
  nextTwinMemoryProactiveStatus,
} from "./twin-memory-proactive";

function evolution(overrides: Partial<TwinMemoryEvolution> = {}): TwinMemoryEvolution {
  return {
    hypothesisId: "fatigue",
    kind: "strengthened",
    basis: "status_transition",
    currentStatus: "supported",
    previousStatus: "monitoring",
    evidenceDelta: 0,
    comparisonAvailable: true,
    occurredAt: "2026-09-10T08:00:00.000Z",
    athleteStateSnapshotId: "11111111-1111-4111-8111-111111111111",
    source: "deterministic",
    ...overrides,
  };
}

describe("Twin Memory proactive policy", () => {
  it("surfaces a deterministic status transition with no decision authority", () => {
    expect(buildTwinMemoryProactiveSignal(evolution())).toEqual({
      fingerprint: "twin-memory:fatigue:strengthened:11111111-1111-4111-8111-111111111111",
      hypothesisId: "fatigue",
      kind: "strengthened",
      severity: "positive",
      source: "deterministic",
      decisionAuthority: false,
      athleteStateSnapshotId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("does not notify for ordinary evidence accumulation", () => {
    expect(
      buildTwinMemoryProactiveSignal(evolution({ basis: "evidence_delta", evidenceDelta: 1 })),
    ).toBeNull();
  });

  it("does not notify when the comparison baseline is unavailable", () => {
    expect(
      buildTwinMemoryProactiveSignal(
        evolution({
          kind: "unknown",
          basis: "baseline_unavailable",
          comparisonAvailable: false,
          athleteStateSnapshotId: null,
        }),
      ),
    ).toBeNull();
  });

  it("marks weakening and contradiction as attention, not medical alarm", () => {
    expect(buildTwinMemoryProactiveSignal(evolution({ kind: "weakened" }))?.severity).toBe(
      "attention",
    );
    expect(buildTwinMemoryProactiveSignal(evolution({ kind: "contradicted" }))?.severity).toBe(
      "attention",
    );
  });
  it("turns a persisted status transition into one deterministic proactive signal", () => {
    const signal = buildTwinMemoryProactiveSignalFromTransition({
      hypothesisId: "fatigue",
      athleteStateSnapshotId: "11111111-1111-4111-8111-111111111111",
      domain: "training_response",
      previousStatus: "monitoring",
      status: "supported",
      statementKey: "athlete.hypothesis.trainingResponse.repeatedLowFeeling",
      evidence: [],
      evidenceCount: 6,
      minimumEvidenceCount: 6,
      canInfluenceDecision: true,
      source: "deterministic",
    });
    expect(signal).toMatchObject({
      kind: "strengthened",
      severity: "positive",
      decisionAuthority: false,
      source: "deterministic",
    });
  });
  it("keeps dismissed proactive changes terminal and makes seen idempotent", () => {
    expect(nextTwinMemoryProactiveStatus("new", "seen")).toBe("seen");
    expect(nextTwinMemoryProactiveStatus("seen", "seen")).toBe("seen");
    expect(nextTwinMemoryProactiveStatus("seen", "dismissed")).toBe("dismissed");
    expect(nextTwinMemoryProactiveStatus("dismissed", "seen")).toBe("dismissed");
  });
  it("keeps lifecycle presentation-only with no decision authority", () => {
    expect(nextTwinMemoryProactiveStatus("new", "seen")).toBe("seen");
    expect(nextTwinMemoryProactiveStatus("seen", "dismissed")).toBe("dismissed");
    const signal = buildTwinMemoryProactiveSignal(evolution());
    expect(signal?.decisionAuthority).toBe(false);
  });
  it("prioritizes attention changes over newer positive changes", () => {
    const base = {
      fingerprint: "base",
      hypothesisId: "base",
      severity: "positive" as const,
      source: "deterministic" as const,
      decisionAuthority: false as const,
      athleteStateSnapshotId: "11111111-1111-4111-8111-111111111111",
      status: "new" as const,
      statusChangedAt: null,
    };
    const selected = selectTwinMemoryProactiveChange([
      {
        ...base,
        fingerprint: "newer",
        hypothesisId: "newer",
        kind: "strengthened",
        occurredAt: "2026-09-12T10:00:00.000Z",
      },
      {
        ...base,
        fingerprint: "older-risk",
        hypothesisId: "older-risk",
        kind: "contradicted",
        severity: "attention",
        occurredAt: "2026-09-12T09:00:00.000Z",
      },
    ]);
    expect(selected?.hypothesisId).toBe("older-risk");
  });

  it("uses recency only after material priority and ignores seen records", () => {
    const base = {
      severity: "positive" as const,
      source: "deterministic" as const,
      decisionAuthority: false as const,
      athleteStateSnapshotId: "11111111-1111-4111-8111-111111111111",
      statusChangedAt: null,
    };
    const selected = selectTwinMemoryProactiveChange([
      {
        ...base,
        fingerprint: "seen",
        hypothesisId: "seen",
        kind: "contradicted",
        severity: "attention",
        status: "seen",
        occurredAt: "2026-09-12T11:00:00.000Z",
      },
      {
        ...base,
        fingerprint: "older",
        hypothesisId: "older",
        kind: "strengthened",
        status: "new",
        occurredAt: "2026-09-12T09:00:00.000Z",
      },
      {
        ...base,
        fingerprint: "newer",
        hypothesisId: "newer",
        kind: "strengthened",
        status: "new",
        occurredAt: "2026-09-12T10:00:00.000Z",
      },
    ]);
    expect(selected?.hypothesisId).toBe("newer");
  });

  it("returns the full fresh queue in material-priority order", () => {
    const base = {
      source: "deterministic" as const,
      decisionAuthority: false as const,
      athleteStateSnapshotId: "11111111-1111-4111-8111-111111111111",
      status: "new" as const,
      statusChangedAt: null,
    };
    const queue = rankTwinMemoryProactiveChanges(
      [
        {
          ...base,
          fingerprint: "positive",
          hypothesisId: "positive",
          kind: "strengthened",
          severity: "positive",
          occurredAt: "2026-09-12T10:00:00.000Z",
        },
        {
          ...base,
          fingerprint: "risk",
          hypothesisId: "risk",
          kind: "weakened",
          severity: "attention",
          occurredAt: "2026-09-12T09:00:00.000Z",
        },
      ],
      new Date("2026-09-12T12:00:00.000Z"),
    );
    expect(queue.map((item) => item.hypothesisId)).toEqual(["risk", "positive"]);
  });

  it("does not surface stale or future records as current proactive intelligence", () => {
    const base = {
      severity: "positive" as const,
      source: "deterministic" as const,
      decisionAuthority: false as const,
      athleteStateSnapshotId: "11111111-1111-4111-8111-111111111111",
      statusChangedAt: null,
      status: "new" as const,
      kind: "strengthened" as const,
    };
    const now = new Date("2026-09-12T12:00:00.000Z");
    const selected = selectTwinMemoryProactiveChange(
      [
        {
          ...base,
          fingerprint: "stale",
          hypothesisId: "stale",
          occurredAt: "2026-09-01T12:00:00.000Z",
        },
        {
          ...base,
          fingerprint: "future",
          hypothesisId: "future",
          occurredAt: "2026-09-13T12:00:00.000Z",
        },
        {
          ...base,
          fingerprint: "fresh",
          hypothesisId: "fresh",
          occurredAt: "2026-09-10T12:00:00.000Z",
        },
      ],
      now,
    );
    expect(selected?.hypothesisId).toBe("fresh");
  });
});
