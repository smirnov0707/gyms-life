import { describe, expect, it } from "vitest";
import { buildFutureMeGovernance } from "./future-me-governance";
import type { DeterministicLiftForecast } from "./forecast.schema";

const lift: DeterministicLiftForecast = {
  exerciseSlug: "bench-press",
  exerciseName: "Bench Press",
  currentEstimated1RMKg: 100,
  projected4WeeksEstimated1RMKg: 102,
  projected12WeeksEstimated1RMKg: 104,
  trend: "rising",
  evidenceStrength: "moderate",
  evidence: {
    sessionCount: 8,
    weeksTracked: 6,
    spanDays: 60,
    averageRpe: 8,
    observedWeeklyChangeKg: 0.8,
  },
};

describe("Future Me simulation governance", () => {
  it("keeps validated horizons as simulations with zero decision authority", () => {
    expect(buildFutureMeGovernance(lift, "30d")).toMatchObject({
      kind: "simulation",
      outputAvailable: true,
      evidenceStrength: "moderate",
      decisionAuthority: false,
      causalClaimAllowed: false,
      guaranteeAllowed: false,
    });
  });

  it("locks unsupported horizons instead of extrapolating them", () => {
    const state = buildFutureMeGovernance(lift, "1y");
    expect(state.outputAvailable).toBe(false);
    expect(state.assumptions.length).toBeGreaterThan(0);
  });
});
