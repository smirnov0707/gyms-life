import { describe, expect, it } from "vitest";
import { humanOverlayStyle } from "./human-overlay.model";
import { TWIN_DISPLAY_COLORS, type TwinSceneState } from "./twin-scene.model";
const state: TwinSceneState = {
  layer: "recovery", dataAvailable: true,
  regions: [{ id: "chest", band: "moderate", recoveryPct: 77, emphasis: 0.2, display: { value: 77, tone: "moderate" } }],
};
describe("human appearance is independent of physiological truth", () => {
  it("natural skin contains no evidence tint", () => {
    expect(humanOverlayStyle(state, "chest", null, true).amount).toBe(0);
    expect(humanOverlayStyle({ ...state, dataAvailable: false }, "chest", null, true).amount).toBe(0);
  });
  it("unknown data cannot inherit a positive leftover colour", () => {
    const unknown: TwinSceneState = { ...state, regions: [{ id: "chest", band: "moderate", recoveryPct: 77, emphasis: 0.2, display: { value: null, tone: "fresh" } }] };
    expect(humanOverlayStyle(unknown, "chest", null, false).color).toBe(TWIN_DISPLAY_COLORS.unknown);
    expect(humanOverlayStyle({ ...state, dataAvailable: false }, "chest", null, false).color).toBe(TWIN_DISPLAY_COLORS.unknown);
  });
  it("overlays retain the source texture instead of replacing its colour", () => {
    expect(humanOverlayStyle(state, "chest", null, false)).toEqual({ color: TWIN_DISPLAY_COLORS.moderate, amount: 0.18 });
    expect(humanOverlayStyle(state, "chest", "chest", true).amount).toBe(0.12);
    expect(humanOverlayStyle(state, "chest", "chest", false).amount).toBeLessThan(0.3);
    expect(state.regions[0]?.display.value).toBe(77);
  });
});
