import { describe, expect, it } from "vitest";
import type { TwinMemoryEvolution } from "./twin-memory-evolution";
import {
  buildTwinMemoryProactiveSignal,
  buildTwinMemoryProactiveSignalFromTransition,
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
});
