import { describe, expect, it } from "vitest";
import { KNOWN_MUSCLE_GROUPS } from "@/lib/muscle-load.schema";
import {
  BODY_ANATOMY,
  BODY_FRAME,
  BODY_REGION_SEGMENTS,
  BODY_VIEW_BOX,
  REGION_ANCHOR,
  NON_ANATOMICAL_GROUPS,
  isAnatomicalRegion,
  openingView,
  segmentsFor,
  viewShowing,
  type BodyView,
} from "./body-map.geometry";

const VIEWS: BodyView[] = ["front", "back"];

/** Every path is `M x y C … Z`, so the numbers alternate x, y from the start. */
function pointsIn(d: string): { x: number; y: number }[] {
  const numbers = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const points: { x: number; y: number }[] = [];
  for (let index = 0; index + 1 < numbers.length; index += 2) {
    const x = numbers[index];
    const y = numbers[index + 1];
    if (x === undefined || y === undefined) continue;
    points.push({ x, y });
  }
  return points;
}

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

  it("accounts for every muscle group the database can hold", () => {
    // The other direction of the check above, and the one that actually
    // loses data: a group that is neither drawable nor explicitly
    // non-anatomical would have its training load computed and then rendered
    // nowhere. `exercises_muscle_group_known` lets exactly these values into
    // the database, so exactly these must have somewhere to go.
    const offBody = new Set<string>(NON_ANATOMICAL_GROUPS);
    for (const group of KNOWN_MUSCLE_GROUPS) {
      const placed = isAnatomicalRegion(group) || offBody.has(group);
      expect(placed, `${group} has nowhere to render`).toBe(true);
    }
  });

  it("gives every mapped region at least one drawable view", () => {
    for (const region of Object.keys(BODY_REGION_SEGMENTS)) {
      const total = segmentsFor(region, "front").length + segmentsFor(region, "back").length;
      expect(total).toBeGreaterThan(0);
    }
  });

  it("places front-only and back-only regions on the correct side", () => {
    for (const region of ["chest", "abs", "core"]) {
      expect(segmentsFor(region, "front").length).toBeGreaterThan(0);
      expect(segmentsFor(region, "back")).toEqual([]);
    }
    expect(segmentsFor("glutes", "back").length).toBeGreaterThan(0);
    expect(segmentsFor("glutes", "front")).toEqual([]);
  });

  it("shows the back from the front only through the trapezius", () => {
    // The upper trapezius really is visible from the front, so back work
    // shows there — but only as that one pair of shapes, never the lats.
    expect(segmentsFor("back", "front")).toHaveLength(2);
    expect(segmentsFor("back", "back").length).toBeGreaterThan(segmentsFor("back", "front").length);
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

  describe("openingView", () => {
    it("opens on the front for a front region", () => {
      expect(openingView(["chest", "glutes"])).toBe("front");
    });

    it("opens on the back when the most important region is only there", () => {
      // Otherwise the figure renders entirely grey and reads as "no data"
      // while the data sits on the side nobody is looking at.
      expect(openingView(["glutes", "chest"])).toBe("back");
    });

    it("skips regions that are not on the body at all", () => {
      expect(openingView(["cardio", "glutes"])).toBe("back");
    });

    it("falls back to the front when nothing is drawable", () => {
      expect(openingView([])).toBe("front");
      expect(openingView(["cardio", "mobility"])).toBe("front");
    });
  });

  describe("viewShowing", () => {
    it("stays put when the region is fully drawn on the current side", () => {
      expect(viewShowing("chest", "front")).toBe("front");
      expect(viewShowing("glutes", "back")).toBe("back");
    });

    it("turns the figure around when the region is not on this side at all", () => {
      expect(viewShowing("glutes", "front")).toBe("back");
      expect(viewShowing("chest", "back")).toBe("front");
    });

    it("turns to the side that shows more of a region drawn on both", () => {
      // The upper trapezius shows from the front, but selecting "back" must
      // not leave the figure facing forward with one strip lit.
      expect(viewShowing("back", "front")).toBe("back");
      expect(viewShowing("shoulders", "front")).toBe("front");
    });
  });

  it("draws every segment as a closed path", () => {
    for (const region of Object.keys(BODY_REGION_SEGMENTS)) {
      for (const view of VIEWS) {
        for (const segment of segmentsFor(region, view)) {
          expect(segment.d.startsWith("M")).toBe(true);
          expect(segment.d.endsWith("Z")).toBe(true);
        }
      }
    }
  });

  it("keeps every region left-right symmetric about the body's centre line", () => {
    for (const region of Object.keys(BODY_REGION_SEGMENTS)) {
      for (const view of VIEWS) {
        const segments = segmentsFor(region, view);
        if (segments.length === 0) continue;
        // A shape and its mirror are always drawn as a pair.
        expect(segments.length % 2).toBe(0);
        const xs = segments.flatMap((segment) => pointsIn(segment.d).map((point) => point.x));
        const mirrored = xs.map((x) => 200 - x);
        expect([...mirrored].sort((a, b) => a - b)).toEqual([...xs].sort((a, b) => a - b));
      }
    }
  });

  it("only anchors a callout where that region is actually drawn", () => {
    for (const [region, byView] of Object.entries(REGION_ANCHOR)) {
      expect(isAnatomicalRegion(region)).toBe(true);
      for (const view of VIEWS) {
        const anchor = byView[view];
        if (anchor === undefined) continue;
        // A leader pointing at a side the region is not drawn on would name
        // a region the figure is not showing.
        expect(segmentsFor(region, view).length).toBeGreaterThan(0);
      }
    }
  });

  it("draws structure that belongs to no group symmetrically too", () => {
    for (const view of VIEWS) {
      const xs = BODY_ANATOMY[view].flatMap((d) => pointsIn(d).map((point) => point.x));
      expect(xs.length).toBeGreaterThan(0);
      expect(xs.map((x) => 200 - x).sort((a, b) => a - b)).toEqual([...xs].sort((a, b) => a - b));
    }
  });

  it("never draws outside the view box", () => {
    const { minX, minY, width, height } = BODY_VIEW_BOX;
    const all = [
      ...Object.keys(BODY_REGION_SEGMENTS).flatMap((region) =>
        VIEWS.flatMap((view) => segmentsFor(region, view).map((segment) => segment.d)),
      ),
      ...VIEWS.flatMap((view) => BODY_ANATOMY[view]),
      BODY_FRAME.silhouette,
    ];

    for (const d of all) {
      for (const point of pointsIn(d)) {
        expect(point.x).toBeGreaterThanOrEqual(minX);
        expect(point.x).toBeLessThanOrEqual(minX + width);
        expect(point.y).toBeGreaterThanOrEqual(minY);
        expect(point.y).toBeLessThanOrEqual(minY + height);
      }
    }
  });
});
