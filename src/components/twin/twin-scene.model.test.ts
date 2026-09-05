import { describe, expect, it } from "vitest";
import type { TwinSnapshot, TwinRegionState } from "@/lib/digital-twin.schema";
import { mapTwinSnapshotToVisualState } from "@/lib/digital-twin.visual-state";
import { KNOWN_MUSCLE_GROUPS } from "@/lib/muscle-load.schema";
import { createTwinBody } from "./twin-body.geometry";
import {
  TWIN_BODY_REGIONS, TWIN_CAMERA, fittedTwinDistance, isTwinBodyRegion, isTwinTap,
  mapTwinScene, moveTwinCamera, shouldAnimateTwin,
} from "./twin-scene.model";

const chest: TwinRegionState = { region: "chest", provenance: "calculated", recoveryPct: 77, recoveryBand: "moderate", volumeKg: 1000, lastTrainedHoursAgo: 48 };
const fixture = (regions: TwinRegionState[] = []): TwinSnapshot => ({
  calculationVersion: "test-only", computedAt: "2026-09-05T12:00:00Z", evidenceWindowDays: 14, dataAvailable: true, regions,
});

describe("Twin scene data boundary", () => {
  it("only maps the current coarse catalogue groups, never invented sub-muscles", () => {
    expect(TWIN_BODY_REGIONS.every((id) => KNOWN_MUSCLE_GROUPS.some((group) => group === id))).toBe(true);
    expect(isTwinBodyRegion("biceps")).toBe(false);
    expect(isTwinBodyRegion("fullbody")).toBe(false);
    expect(isTwinBodyRegion("cardio")).toBe(false);
    expect(isTwinBodyRegion("mobility")).toBe(false);
  });
  it("makes every absent region unknown, not recovered", () => {
    expect(mapTwinScene(fixture()).regions).toHaveLength(8);
    expect(mapTwinScene(fixture()).regions.every((region) => region.band === "unknown" && region.recoveryPct === null && region.emphasis === 0)).toBe(true);
  });
  it("preserves canonical bands instead of recalculating thresholds", () => {
    const state = fixture([chest]);
    expect(mapTwinScene(state).regions.find((region) => region.id === "chest")?.band).toBe("moderate");
    expect(mapTwinSnapshotToVisualState(state).regions[0]?.attention).toBe("medium");
  });
  it("does not let a leftover value override unknown provenance", () => {
    const mapped = mapTwinScene(fixture([{ ...chest, provenance: "unknown", recoveryPct: 99 }]));
    expect(mapped.regions.find((region) => region.id === "chest")?.recoveryPct).toBeNull();
  });
  it("does not place whole-body or cardio evidence on individual muscles", () => {
    expect(mapTwinScene(fixture([{ ...chest, region: "fullbody" }])).regions.every((region) => region.band === "unknown")).toBe(true);
  });
  it("retains source failure rather than reporting complete data", () => {
    expect(mapTwinScene({ ...fixture(), dataAvailable: false }).dataAvailable).toBe(false);
  });
  it("does not mutate the canonical snapshot", () => {
    const snapshot = fixture([chest]);
    const before = structuredClone(snapshot);
    mapTwinScene(snapshot);
    expect(snapshot).toEqual(before);
  });
});

describe("Twin camera and gestures", () => {
  it("supports multiple full horizontal turns without hitting an azimuth stop", () => {
    let pose = { yaw: 0, pitch: Math.PI / 2, distance: 4 };
    for (let i = 0; i < 48; i++) pose = moveTwinCamera(pose, "rotate-right", 4);
    expect(pose.yaw).toBeCloseTo(6 * Math.PI);
  });
  it("bounds zoom and pitch", () => {
    let pose = { yaw: 0, pitch: 0, distance: 4 };
    for (let i = 0; i < 100; i++) pose = moveTwinCamera(pose, "zoom-in", 4);
    expect(pose.distance).toBeCloseTo(4 * TWIN_CAMERA.minDistanceRatio);
    expect(pose.pitch).toBe(TWIN_CAMERA.minPitch);
    for (let i = 0; i < 100; i++) pose = moveTwinCamera(pose, "zoom-out", 4);
    expect(pose.distance).toBeCloseTo(4 * TWIN_CAMERA.maxDistanceRatio);
  });
  it("has front, back, side and reset positions", () => {
    const pose = { yaw: 9, pitch: Math.PI / 2, distance: 4 };
    expect(moveTwinCamera(pose, "back", 4).yaw).toBe(Math.PI);
    expect(moveTwinCamera(pose, "left", 4).yaw).toBe(-Math.PI / 2);
    expect(moveTwinCamera(pose, "right", 4).yaw).toBe(Math.PI / 2);
    expect(moveTwinCamera(pose, "reset", 4)).toEqual({ yaw: 0, pitch: TWIN_CAMERA.defaultPitch, distance: 4 });
  });
  it("falls back safely for invalid camera dimensions", () => {
    expect(Number.isFinite(fittedTwinDistance(Number.NaN))).toBe(true);
    expect(Number.isFinite(moveTwinCamera({ yaw: Infinity, pitch: Infinity, distance: Infinity }, "reset", NaN).distance)).toBe(true);
  });
  it("does not mistake a drag, pinch or invalid event for a tap", () => {
    expect(isTwinTap(2, false)).toBe(true);
    expect(isTwinTap(9, false)).toBe(false);
    expect(isTwinTap(0, true)).toBe(false);
    expect(isTwinTap(NaN, false)).toBe(false);
  });
  it("stops decorative motion when hidden, reduced or disabled", () => {
    expect(shouldAnimateTwin(true, false, true)).toBe(true);
    expect(shouldAnimateTwin(false, false, true)).toBe(false);
    expect(shouldAnimateTwin(true, true, true)).toBe(false);
    expect(shouldAnimateTwin(true, false, false)).toBe(false);
  });
});

describe("schematic 3D geometry", () => {
  it("has real depth and a selectable mesh for every supported region", () => {
    const model = createTwinBody();
    try {
      expect([...model.regionMeshes.keys()].sort()).toEqual([...TWIN_BODY_REGIONS].sort());
      model.body.updateMatrixWorld(true);
      for (const mesh of model.meshes) {
        const vertices = mesh.geometry.getAttribute("position");
        expect([...vertices.array].every(Number.isFinite)).toBe(true);
        mesh.geometry.computeBoundingBox();
        expect(mesh.geometry.boundingBox!.max.z - mesh.geometry.boundingBox!.min.z).toBeGreaterThan(0);
      }
    } finally { model.dispose(); }
  });
});
