import { describe, expect, it } from "vitest";
import { KNOWN_MUSCLE_GROUPS } from "@/lib/muscle-load.schema";
import {
  BODY_REGION_SEGMENTS,
  NON_ANATOMICAL_GROUPS,
  isAnatomicalRegion,
  segmentsFor,
} from "./body-map.geometry";

describe("body map geometry", () => {
  it("never places a non-anatomical training group on the body", () => {
    for (const group of NON_ANATOMICAL_GROUPS) {
      expect(isAnatomicalRegion(group)).toBe(false);
      expect(segmentsFor(group, "front")).toEqual([]);
      expect(segmentsFor(group, "back")).toEqual([]);
    }
  });

  it("only maps regions that actually exist in the muscle-group vocabulary", () => {
    for (const region of Object.keys(BODY_REGION_SEGMENTS)) {
      expect(KNOWN_MUSCLE_GROUPS).toContain(region);
    }
  });

  it("gives every mapped region at least one drawable view", () => {
    for (const region of Object.keys(BODY_REGION_SEGMENTS)) {
      const total = segmentsFor(region, "front").length + segmentsFor(region, "back").length;
      expect(total).toBeGreaterThan(0);
    }
  });

  it("places front-only and back-only regions on the correct side", () => {
    expect(segmentsFor("chest", "front").length).toBeGreaterThan(0);
    expect(segmentsFor("chest", "back")).toEqual([]);
    expect(segmentsFor("back", "back").length).toBeGreaterThan(0);
    expect(segmentsFor("back", "front")).toEqual([]);
    expect(segmentsFor("glutes", "back").length).toBeGreaterThan(0);
    expect(segmentsFor("glutes", "front")).toEqual([]);
  });

  it("keeps limbs visible from both views", () => {
    for (const region of ["arms", "legs", "shoulders"]) {
      expect(segmentsFor(region, "front").length).toBeGreaterThan(0);
      expect(segmentsFor(region, "back").length).toBeGreaterThan(0);
    }
  });

  it("returns nothing for a region it has never heard of", () => {
    expect(isAnatomicalRegion("forearms")).toBe(false);
    expect(segmentsFor("forearms", "front")).toEqual([]);
  });
});
