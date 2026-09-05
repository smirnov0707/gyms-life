import { describe, expect, it } from "vitest";
import { buildRiskReport, type RiskSetRow } from "./injury-risk";

const NOW = Date.parse("2026-09-05T12:00:00.000Z");
const DAY = 86_400_000;

/** One working set of the same movement, at a given instant. */
function set(performedAt: number): RiskSetRow {
  return {
    performed_at: new Date(performedAt).toISOString(),
    exercise_slug: "barbell-squat",
    exercise_name: "Barbell Squat",
    weight_kg: 100,
    reps: 10,
  };
}

const acwrOf = (report: ReturnType<typeof buildRiskReport>) =>
  report.factors.find((factor) => factor.key === "nx.risk.acwr")?.value ?? null;

describe("buildRiskReport", () => {
  it("reports nothing when there is nothing logged", () => {
    const report = buildRiskReport([], [], [], NOW);
    expect(report.hasData).toBe(false);
  });

  it("reads a steady four weeks as an unremarkable workload", () => {
    // Three sets a week for four weeks. The acute window carries a one-day
    // buffer, so the ratio is near rather than exactly 1 — what matters is
    // that a steady month is not flagged.
    const sets: RiskSetRow[] = [];
    for (let day = 27; day >= 0; day -= 1) {
      if (day % 7 < 3) sets.push(set(NOW - day * DAY));
    }
    const report = buildRiskReport(sets, [], [], NOW);
    const factor = report.factors.find((f) => f.key === "nx.risk.acwr");
    expect(factor?.level).not.toBe("high");
  });

  it("does not manufacture a spike from sets that synced late", () => {
    // The bug this column exists for. A month of steady training, except
    // that the sets performed 8-14 days ago were logged offline and only
    // reached the server today. Dated by arrival they leave the chronic
    // window and pile into the acute one, so the same training reads as a
    // sudden jump in workload.
    const performed: RiskSetRow[] = [];
    for (let day = 27; day >= 0; day -= 1) {
      if (day % 7 < 3) performed.push(set(NOW - day * DAY));
    }
    const asIfSyncedOnArrival = performed.map((row) => {
      const day = Math.round((NOW - Date.parse(row.performed_at)) / DAY);
      return day >= 8 && day <= 14 ? set(NOW - DAY / 2) : row;
    });

    const honest = buildRiskReport(performed, [], [], NOW);
    const bunched = buildRiskReport(asIfSyncedOnArrival, [], [], NOW);

    expect(honest.factors.find((f) => f.key === "nx.risk.acwr")?.level).not.toBe("high");
    expect(acwrOf(bunched)).not.toBe(acwrOf(honest));
    expect(bunched.score).toBeGreaterThan(honest.score);
  });

  it("flags a genuine spike in the last week", () => {
    const sets: RiskSetRow[] = [];
    // A light month...
    for (let day = 27; day >= 8; day -= 1) {
      if (day % 7 === 0) sets.push(set(NOW - day * DAY));
    }
    // ...then a very heavy week.
    for (let i = 0; i < 20; i += 1) sets.push(set(NOW - (i % 6) * DAY));

    const report = buildRiskReport(sets, [], [], NOW);
    const factor = report.factors.find((f) => f.key === "nx.risk.acwr");
    expect(factor?.level).toBe("high");
  });
});

describe("unassessed signals", () => {
  it("names every factor this history cannot support", () => {
    const report = buildRiskReport([], [], [], NOW);

    // Nothing logged at all: none of the five terms has an input, so the
    // score of 0 is an absence of evidence rather than an absence of risk.
    expect(report.score).toBe(0);
    expect(report.unassessed).toEqual([
      "nx.risk.acwr",
      "nx.risk.balance",
      "nx.risk.recovery",
      "nx.risk.readiness",
      "nx.risk.jump",
    ]);
  });

  it("keeps the readiness term open when an athlete trains but never checks in", () => {
    // A month of steady squatting and not one check-in. The readiness term
    // contributes nothing, which flatters the score; the panel needs to be
    // able to say so.
    const sets: RiskSetRow[] = [];
    for (let day = 27; day >= 0; day -= 1) {
      if (day % 7 < 3) sets.push(set(NOW - day * DAY));
    }
    const report = buildRiskReport(sets, [], [], NOW);

    expect(report.factors.some((factor) => factor.key === "nx.risk.acwr")).toBe(true);
    expect(report.unassessed).toContain("nx.risk.readiness");
    // A factor is never both assessed and unassessed.
    for (const factor of report.factors) {
      expect(report.unassessed).not.toContain(factor.key);
    }
  });
});
