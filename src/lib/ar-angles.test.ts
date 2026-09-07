import { describe, expect, it } from "vitest";
import {
  angleAt,
  AR_EXERCISES,
  evaluateTargets,
  landmarkVisible,
  LM,
  LANDMARK_VISIBILITY_FLOOR,
  type Point,
} from "./ar-angles";

/**
 * The camera coaching had no tests, and every claim it makes is about the
 * athlete's own body in the moment. The properties worth pinning are the ones
 * that decide whether a correction is shouted at someone: a joint the camera
 * could not see must produce no angle, a failed measurement must not become
 * an extreme reading, and nothing measured must never read as good form.
 */

const at = (x: number, y: number, visibility?: number): Point =>
  visibility === undefined ? { x, y } : { x, y, visibility };

/** A pose array with only the given landmarks filled in. */
function pose(entries: Record<number, Point>): Point[] {
  const list: Point[] = [];
  for (const [index, point] of Object.entries(entries)) list[Number(index)] = point;
  return list;
}

const squat = AR_EXERCISES.find((exercise) => exercise.slug === "squat")!;

describe("angleAt", () => {
  it("measures a right angle as ninety degrees", () => {
    expect(angleAt(at(0, 1), at(0, 0), at(1, 0))).toBeCloseTo(90, 6);
  });

  it("measures a straight line as a hundred and eighty", () => {
    expect(angleAt(at(-1, 0), at(0, 0), at(1, 0))).toBeCloseTo(180, 6);
  });

  it("says nothing rather than zero when there is no angle to measure", () => {
    // Zero degrees is a real reading — a fully folded joint. Returning it for
    // a degenerate triangle turned a failed measurement into the most extreme
    // possible one, and the caller then told the athlete their knee was
    // too deep.
    expect(angleAt(at(0, 0), at(0, 0), at(1, 0))).toBeNull();
    expect(angleAt(at(1, 0), at(0, 0), at(0, 0))).toBeNull();
    expect(angleAt(at(Number.NaN, 0), at(0, 0), at(1, 0))).toBeNull();
  });
});

describe("landmarkVisible", () => {
  it("rejects a landmark the model is not confident about", () => {
    expect(landmarkVisible(at(0.5, 0.5, LANDMARK_VISIBILITY_FLOOR - 0.01))).toBe(false);
    expect(landmarkVisible(at(0.5, 0.5, LANDMARK_VISIBILITY_FLOOR))).toBe(true);
  });

  it("takes a landmark that reports no confidence at its word", () => {
    // Present and unscored is not the same as scored low, and a source that
    // does not report confidence should not have its readings thrown away.
    expect(landmarkVisible(at(0.5, 0.5))).toBe(true);
  });

  it("rejects what is not there at all", () => {
    expect(landmarkVisible(undefined)).toBe(false);
    expect(landmarkVisible(at(Number.NaN, 0.5))).toBe(false);
  });
});

describe("evaluateTargets", () => {
  /** Knee bent to 90°, torso upright: the knee target reads low, torso is ok. */
  const deepSquat = pose({
    [LM.rShoulder]: at(0.5, 0.2),
    [LM.rHip]: at(0.5, 0.5),
    [LM.rKnee]: at(0.5, 0.7),
    [LM.rAnkle]: at(0.7, 0.7),
  });

  it("measures what the camera can see", () => {
    const states = evaluateTargets(deepSquat, squat, "en");
    expect(states.map((state) => state.id)).toEqual(["knee", "torso"]);
    const knee = states.find((state) => state.id === "knee");
    expect(knee?.angle).toBe(90);
    expect(knee?.status).toBe("ok");
  });

  it("does not crash on a pose shorter than the landmarks it needs", () => {
    // The three landmarks used to be asserted with `!`, which is a TypeError
    // the moment the model returns fewer of them.
    expect(() => evaluateTargets([], squat, "en")).not.toThrow();
    expect(evaluateTargets([], squat, "en")).toEqual([]);
  });

  it("leaves out a target whose joint the camera could not see", () => {
    const occluded = pose({
      ...Object.fromEntries(
        Object.entries(deepSquat).map(([index, point]) => [Number(index), point as Point]),
      ),
      [LM.rAnkle]: at(0.7, 0.7, 0.1),
    });
    const states = evaluateTargets(occluded, squat, "en");
    // The knee target needs the ankle; the torso target does not.
    expect(states.map((state) => state.id)).toEqual(["torso"]);
  });

  it("never returns a fabricated angle for an unmeasurable joint", () => {
    const collapsed = pose({
      [LM.rShoulder]: at(0.5, 0.5),
      [LM.rHip]: at(0.5, 0.5),
      [LM.rKnee]: at(0.5, 0.5),
      [LM.rAnkle]: at(0.5, 0.5),
    });
    // Every triple is degenerate, so nothing is reported at all — rather than
    // four zero-degree readings, each of which would fire a correction.
    expect(evaluateTargets(collapsed, squat, "en")).toEqual([]);
  });

  it("gives a cue only when the angle is outside the target's range", () => {
    const states = evaluateTargets(deepSquat, squat, "en");
    for (const state of states) {
      if (state.status === "ok") expect(state.cue).toBe("");
      else expect(state.cue.length).toBeGreaterThan(0);
    }
  });
});
