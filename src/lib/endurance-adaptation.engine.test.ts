import { describe, expect, it } from "vitest";
import { decideEnduranceAdaptation } from "./endurance-adaptation.engine";

describe("endurance adaptation", () => {
  it("does not change a plan from one isolated hard response", () => {
    expect(decideEnduranceAdaptation({
      completedPlannedSessions: 3,
      plannedSessions: 4,
      lowResponseStreak: 1,
      readinessBand: "moderate",
    })).toEqual({ action: "hold", volumeModifier: 1, reason: "on_track" });
  });

  it("reduces volume after repeated low response", () => {
    expect(decideEnduranceAdaptation({
      completedPlannedSessions: 4,
      plannedSessions: 4,
      lowResponseStreak: 3,
      readinessBand: "moderate",
    }).volumeModifier).toBe(0.8);
  });

  it("prioritizes recovery when low readiness coincides with missed work", () => {
    expect(decideEnduranceAdaptation({
      completedPlannedSessions: 1,
      plannedSessions: 4,
      lowResponseStreak: 0,
      readinessBand: "low",
    })).toEqual({
      action: "recover",
      volumeModifier: 0.7,
      reason: "low_readiness_and_missed_work",
    });
  });
});
