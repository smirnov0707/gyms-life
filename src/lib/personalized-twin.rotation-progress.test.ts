import { describe, expect, it } from "vitest";
import {
  INITIAL_TWIN_ROTATION_PROGRESS,
  updateTwinRotationProgress,
} from "./personalized-twin.rotation-progress";

function feed(ratios: number[]) {
  let state = INITIAL_TWIN_ROTATION_PROGRESS;
  for (const ratio of ratios) {
    state = updateTwinRotationProgress(state, {
      framingReady: true,
      shoulderSpanRatio: ratio,
    });
  }
  return state;
}

describe("Personalized Twin rotation progress", () => {
  it("requires a wide-narrow-wide-narrow-wide silhouette sequence", () => {
    const five = (value: number) => Array.from({ length: 5 }, () => value);
    const state = feed([...five(0.5), ...five(0.2), ...five(0.5), ...five(0.2), ...five(0.5)]);
    expect(state.completeEstimate).toBe(true);
    expect(state.progressPct).toBe(100);
  });

  it("does not advance while framing is not ready", () => {
    let state = INITIAL_TWIN_ROTATION_PROGRESS;
    for (let index = 0; index < 10; index += 1) {
      state = updateTwinRotationProgress(state, {
        framingReady: false,
        shoulderSpanRatio: 0.5,
      });
    }
    expect(state.progressPct).toBe(0);
  });

  it("does not call standing still a 360-degree turn", () => {
    const state = feed(Array.from({ length: 50 }, () => 0.5));
    expect(state.progressPct).toBe(20);
    expect(state.completeEstimate).toBe(false);
  });
});
