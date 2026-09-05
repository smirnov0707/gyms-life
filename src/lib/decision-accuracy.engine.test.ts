import { describe, expect, it } from "vitest";
import { buildDecisionAccuracy } from "./decision-accuracy.engine";
import type { LabDecision } from "./lab.schema";

let counter = 0;
function decision(basis: LabDecision["basis"], outcome: LabDecision["outcome"]): LabDecision {
  counter += 1;
  return {
    id: `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`,
    decisionOn: "2026-09-01",
    action: "train_as_planned",
    basis,
    status: "active",
    evidence: [],
    outcome,
    createdAt: "2026-09-01T08:00:00.000Z",
  };
}

describe("buildDecisionAccuracy", () => {
  it("counts accepted and completed as fitting, dismissed and not_helpful as not", () => {
    const result = buildDecisionAccuracy([
      decision("current_checkin", "accepted"),
      decision("current_checkin", "completed"),
      decision("current_checkin", "dismissed"),
      decision("current_checkin", "not_helpful"),
    ]);

    expect(result.totalAnswered).toBe(4);
    expect(result.totalFitting).toBe(2);
    expect(result.overallFitRate).toBe(0.5);
  });

  it("never counts an unanswered decision as a failure", () => {
    const result = buildDecisionAccuracy([
      decision("current_checkin", "accepted"),
      decision("current_checkin", "accepted"),
      decision("current_checkin", "accepted"),
      decision("current_checkin", null),
      decision("current_checkin", null),
    ]);

    expect(result.totalProposed).toBe(5);
    expect(result.totalAnswered).toBe(3);
    expect(result.overallFitRate).toBe(1);
  });

  it("withholds a rate below the minimum answered count", () => {
    const result = buildDecisionAccuracy([
      decision("safety_rule", "accepted"),
      decision("safety_rule", "dismissed"),
    ]);

    expect(result.totalAnswered).toBe(2);
    expect(result.overallFitRate).toBeNull();
    expect(result.byBasis[0]?.fitRate).toBeNull();
    // The counts are still reported; only the derived rate is withheld.
    expect(result.byBasis[0]?.fitting).toBe(1);
  });

  it("omits a basis that has never been used rather than showing it as zero", () => {
    const result = buildDecisionAccuracy([decision("observed_pattern", "accepted")]);

    expect(result.byBasis).toHaveLength(1);
    expect(result.byBasis[0]?.basis).toBe("observed_pattern");
  });

  it("separates bases so a weak one cannot hide behind a strong one", () => {
    const result = buildDecisionAccuracy([
      decision("current_checkin", "completed"),
      decision("current_checkin", "completed"),
      decision("current_checkin", "completed"),
      decision("observed_pattern", "dismissed"),
      decision("observed_pattern", "dismissed"),
      decision("observed_pattern", "dismissed"),
    ]);

    const checkin = result.byBasis.find((entry) => entry.basis === "current_checkin");
    const pattern = result.byBasis.find((entry) => entry.basis === "observed_pattern");

    expect(checkin?.fitRate).toBe(1);
    expect(pattern?.fitRate).toBe(0);
    expect(result.overallFitRate).toBe(0.5);
  });

  it("handles an empty history without inventing a rate", () => {
    const result = buildDecisionAccuracy([]);
    expect(result.totalProposed).toBe(0);
    expect(result.overallFitRate).toBeNull();
    expect(result.byBasis).toEqual([]);
  });
});
