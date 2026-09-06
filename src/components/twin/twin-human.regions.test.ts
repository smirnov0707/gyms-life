import { describe, expect, it } from "vitest";
// Typed by scripts/twin-human-regions.d.ts; shared with the asset pipeline.
import {
  regionForBone,
  normaliseBone,
  REGIONS,
  NEUTRAL,
} from "../../../scripts/twin-human-regions.mjs";
import { TWIN_BODY_REGIONS } from "./twin-scene.model";

/**
 * The bone map decides which part of the body a click lands on. It replaced a
 * set of absolute-metre thresholds that only fitted the old generated surface,
 * so the property worth protecting is that it stays anatomical rather than
 * drifting back to coordinates.
 */
describe("twin human region mapping", () => {
  it("uses the same canonical regions as the scene", () => {
    // Two lists of region names that disagree would put data on the wrong body
    // part without anything failing.
    expect([...REGIONS].sort()).toEqual([...TWIN_BODY_REGIONS].sort());
  });

  it("strips node suffixes and sides but keeps chain position", () => {
    expect(normaliseBone("DEF-spine.002_1036")).toBe("DEF-spine.002");
    expect(normaliseBone("DEF-upper_arm.L_1553")).toBe("DEF-upper_arm");
    expect(normaliseBone("DEF-f_ring.03.R_1637")).toBe("DEF-f_ring.03");
  });

  it("puts limbs on their own regions regardless of facing", () => {
    for (const front of [true, false]) {
      expect(regionForBone("DEF-upper_arm.L_1553", front)).toBe("arms");
      expect(regionForBone("DEF-forearm.R.001_1674", front)).toBe("arms");
      expect(regionForBone("DEF-shin.L_1094", front)).toBe("legs");
      expect(regionForBone("DEF-toe.R_1110", front)).toBe("legs");
      expect(regionForBone("DEF-shoulder.L_1443", front)).toBe("shoulders");
    }
  });

  it("counts fingers and palms as arms rather than a region of their own", () => {
    // The app holds no per-finger data, so offering one would invent detail.
    for (const bone of [
      "DEF-f_index.01.L",
      "DEF-f_pinky.03.R",
      "DEF-thumb.02.L",
      "DEF-palm.04.R",
    ]) {
      expect(regionForBone(bone, true)).toBe("arms");
    }
  });

  it("separates chest from back on the same spine bone", () => {
    // The one distinction bones cannot make on their own.
    expect(regionForBone("DEF-spine.002_1036", true)).toBe("chest");
    expect(regionForBone("DEF-spine.002_1036", false)).toBe("back");
    expect(regionForBone("DEF-spine.001_1037", true)).toBe("abs");
    expect(regionForBone("DEF-spine.001_1037", false)).toBe("back");
  });

  it("puts the gluteal surface on the upper thigh, where this rig skins it", () => {
    expect(regionForBone("DEF-thigh.L_1096", false)).toBe("glutes");
    expect(regionForBone("DEF-thigh.L_1096", true)).toBe("legs");
    // Lower thigh segments stay legs on both sides.
    expect(regionForBone("DEF-thigh.L.001_1095", false)).toBe("legs");
  });

  it("leaves the head, face and anything unrecognised neutral", () => {
    for (const bone of [
      "DEF-nose.L.001_1406",
      "DEF-ear.R.003_1274",
      "DEF-jaw_1280",
      "DEF-lid.T.L.002",
      "DEF-brow.T.R.001",
      "DEF-tongue_1282",
      "DEF-spine.006_1032",
      "DEF-spine.005_1033",
    ]) {
      expect(regionForBone(bone, true)).toBe(NEUTRAL);
    }
    // An unknown bone is never guessed into a region the athlete reads data from.
    expect(regionForBone("DEF-something_new_9999", true)).toBe(NEUTRAL);
    expect(regionForBone("", true)).toBe(NEUTRAL);
  });
});
