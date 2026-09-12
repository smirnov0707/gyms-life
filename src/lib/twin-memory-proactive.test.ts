import { describe, expect, it } from "vitest";
import type { TwinMemoryEvolution } from "./twin-memory-evolution";
import { buildTwinMemoryProactiveSignal } from "./twin-memory-proactive";

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
});
