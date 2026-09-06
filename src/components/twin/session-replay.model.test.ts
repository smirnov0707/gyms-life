import { describe, expect, it } from "vitest";
import {
  buildSessionMuscleBreakdown,
  UNASSIGNED_SESSION_REGION,
} from "@/lib/session-muscle-breakdown";
import {
  getSessionReplayDisplay,
  mapSessionReplayScene,
  formatSessionReplayValue,
  SESSION_REPLAY_LAYERS,
} from "./session-replay.model";
const catalogue = [
  { slug: "bench", muscle_group: "chest" },
  { slug: "squat", muscle_group: "legs" },
];
const completed = { exercise_slug: "bench", done: true, reps: 10, weight_kg: 50 };
describe("session logs to shared 360 renderer", () => {
  it("keeps completed counts when mixed volume evidence is incomplete", () => {
    const evidence = buildSessionMuscleBreakdown(
      [completed, { ...completed, weight_kg: null }, { ...completed, exercise_slug: "squat" }],
      catalogue,
    );
    expect(getSessionReplayDisplay(evidence, "chest", "session_sets").value).toBe(2);
    expect(getSessionReplayDisplay(evidence, "chest", "session_volume")).toEqual({
      value: null,
      tone: "unknown",
    });
    expect(getSessionReplayDisplay(evidence, "legs", "session_volume").value).toBe(500);
  });
  it.each(SESSION_REPLAY_LAYERS)("never invents recovery in %s", (layer) => {
    const evidence = buildSessionMuscleBreakdown([completed], catalogue);
    const before = structuredClone(evidence);
    const scene = mapSessionReplayScene(evidence, layer);
    expect(scene.layer).toBe(layer);
    expect(scene.regions).toHaveLength(8);
    expect(
      scene.regions.every(
        (r) => r.recoveryPct === null && r.band === "unknown" && r.emphasis === 0,
      ),
    ).toBe(true);
    expect(scene.regions.find((r) => r.id === "chest")?.display).toEqual(
      getSessionReplayDisplay(evidence, "chest", layer),
    );
    expect(scene.regions.find((r) => r.id === "back")?.display.value).toBeNull();
    expect(evidence).toEqual(before);
  });
  it("keeps unmapped sets outside all anatomical meshes", () => {
    const evidence = buildSessionMuscleBreakdown(
      [{ ...completed, exercise_slug: "unknown" }],
      catalogue,
    );
    expect(getSessionReplayDisplay(evidence, UNASSIGNED_SESSION_REGION, "session_sets").value).toBe(
      1,
    );
    expect(
      mapSessionReplayScene(evidence, "session_sets").regions.every(
        (r) => r.display.value === null,
      ),
    ).toBe(true);
  });
  it("withholds the body on catalogue failure while retaining raw quantities", () => {
    const evidence = buildSessionMuscleBreakdown([completed], catalogue, false);
    for (const layer of SESSION_REPLAY_LAYERS) {
      const scene = mapSessionReplayScene(evidence, layer);
      expect(scene.dataAvailable).toBe(false);
      expect(scene.regions.every((r) => r.display.value === null)).toBe(true);
    }
    expect(evidence[0]?.sets).toBe(1);
  });
  it("restores mapping without changing a previous result", () => {
    const failed = mapSessionReplayScene(
      buildSessionMuscleBreakdown([completed], [], false),
      "session_sets",
    );
    const restored = mapSessionReplayScene(
      buildSessionMuscleBreakdown([completed], catalogue),
      "session_sets",
    );
    expect(restored.regions.find((r) => r.id === "chest")?.display.value).toBe(1);
    expect(failed.regions.every((r) => r.display.value === null)).toBe(true);
  });
  it("shows a registered zero, but never turns a missing region into zero", () => {
    const evidence = buildSessionMuscleBreakdown([{ ...completed, weight_kg: 0 }], catalogue);
    expect(getSessionReplayDisplay(evidence, "chest", "session_volume").value).toBe(0);
    expect(getSessionReplayDisplay(evidence, "back", "session_volume").value).toBeNull();
  });
  it("uses separate layer units", () => {
    expect(formatSessionReplayValue(1, "session_sets", "en")).toBe("1 set");
    expect(formatSessionReplayValue(500, "session_volume", "en")).toBe("500 kg × reps");
    expect(formatSessionReplayValue(null, "session_volume", "en")).toBe("—");
  });
});
