import { describe, expect, it } from "vitest";
import type { DeterministicLiftForecast } from "./forecast.schema";
import {
  isValidatedFutureMeHorizon,
  projectedChangePercent,
  projectedEstimated1RM,
} from "./future-me-simulation";

const lift: DeterministicLiftForecast = {
  exerciseSlug: "bench-press",
  exerciseName: "Bench Press",
  currentEstimated1RMKg: 100,
  projected4WeeksEstimated1RMKg: 103,
  projected12WeeksEstimated1RMKg: 106,
  trend: "rising",
  evidenceStrength: "moderate",
  evidence: {
    sessionCount: 10,
    weeksTracked: 7,
    spanDays: 63,
    averageRpe: 8,
    observedWeeklyChangeKg: 1.2,
  },
};

describe("Future Me projection boundary", () => {
  it("maps 30 and 90 day UI horizons to the forecast engine's validated outputs", () => {
    expect(projectedEstimated1RM(lift, "30d")).toBe(103);
    expect(projectedEstimated1RM(lift, "90d")).toBe(106);
    expect(isValidatedFutureMeHorizon("30d")).toBe(true);
    expect(isValidatedFutureMeHorizon("90d")).toBe(true);
  });

  it("does not extrapolate 180 day or one year values", () => {
    expect(projectedEstimated1RM(lift, "180d")).toBeNull();
    expect(projectedEstimated1RM(lift, "1y")).toBeNull();
    expect(isValidatedFutureMeHorizon("180d")).toBe(false);
    expect(isValidatedFutureMeHorizon("1y")).toBe(false);
  });

  it("calculates a signed percentage only from a real projected value", () => {
    expect(projectedChangePercent(100, 106)).toBe(6);
    expect(projectedChangePercent(100, 97.5)).toBe(-2.5);
    expect(projectedChangePercent(100, null)).toBeNull();
    expect(projectedChangePercent(0, 100)).toBeNull();
  });
});
