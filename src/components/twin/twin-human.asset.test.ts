import { describe, it, expect } from "vitest";
import { Group, Mesh, BoxGeometry, MeshStandardMaterial } from "three";
import { adoptHumanTwinBody, humanRegionTint } from "./twin-human.asset";
import { TWIN_BODY_REGIONS, type TwinSceneState } from "./twin-scene.model";

const state: TwinSceneState = {
  layer: "recovery", dataAvailable: true,
  regions: TWIN_BODY_REGIONS.map((id) => ({ id, band: "moderate", recoveryPct: 60, emphasis: 0.4, display: { value: 60, tone: "moderate" } })),
};
describe("textured human presentation", () => {
  it("natural skin never encodes a recovery or volume number", () => {
    expect(humanRegionTint(state, "chest", "natural")).toEqual({ color: "#ffffff", amount: 0 });
  });
  it("withholds tint when source unavailable even with leftover values", () => {
    expect(humanRegionTint({ ...state, dataAvailable: false }, "chest", "evidence").amount).toBe(0);
  });
  it("keeps absent unknown and non-finite values uncoloured", () => {
    for (const display of [{ value: null, tone: "unknown" }, { value: NaN, tone: "moderate" }] as const) {
      const next = { ...state, regions: state.regions.map((r) => ({ ...r, display })) };
      expect(humanRegionTint(next, "chest", "evidence").amount).toBe(0);
    }
    expect(humanRegionTint({ ...state, regions: [] }, "chest", "evidence").amount).toBe(0);
  });
  it("allows only a restrained tint for a supported value", () => {
    const tint = humanRegionTint(state, "chest", "evidence");
    expect(tint.amount).toBeGreaterThan(0);
    expect(tint.amount).toBeLessThanOrEqual(0.2);
  });
  it("isolates materials by region and preserves neutral occluders", () => {
    const group = new Group(); const material = new MeshStandardMaterial({ color: "#fff" });
    const chest = new Mesh(new BoxGeometry(), material); chest.userData["twinRegion"] = "chest";
    const head = new Mesh(new BoxGeometry(), material); head.userData["twinRegion"] = null;
    group.add(chest, head);
    const model = adoptHumanTwinBody(group); model.applyAppearance(state, "chest", "evidence");
    expect(chest.material).not.toBe(head.material);
    expect(head.material.color.getHexString()).toBe("ffffff");
    expect(model.meshes).toContain(head); expect(model.regionOf.has(head)).toBe(false);
    const original = JSON.stringify(state); model.applyAppearance(state, null, "natural");
    expect(chest.material.color.getHexString()).toBe("ffffff"); expect(JSON.stringify(state)).toBe(original);
    model.dispose(); model.dispose(); expect(group.children).toHaveLength(0);
  });
});
