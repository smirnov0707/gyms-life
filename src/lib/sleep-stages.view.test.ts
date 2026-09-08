import { describe, expect, it } from "vitest";
import { buildSleepNight, type SleepStageSlice } from "./sleep-stages.engine";
import { stageBars } from "./sleep-stages.view";

/**
 * The panel prints, in eight languages, that no percentages are shown because
 * they would be a share of part of a night — and then drew a bar whose width
 * was that share. These tests are about the bar, not the sentence.
 */

const slice = (
  stage: SleepStageSlice["stage"],
  minutes: number,
  share: number | null,
): SleepStageSlice => ({ stage, minutes, share });

describe("the bar under each sleep stage", () => {
  it("is the share of the night when the whole night arrived", () => {
    const bars = stageBars([
      slice("deep", 90, 0.25),
      slice("rem", 90, 0.25),
      slice("core", 180, 0.5),
    ]);
    expect(bars.basis).toBe("night");
    expect(bars.bars.map((bar) => bar.widthPercent)).toEqual([25, 25, 50]);
  });

  it("draws that width from the same number it prints", () => {
    // Two calculations of one quantity are two chances to disagree. The change
    // map had exactly this: a colour off the raw delta beside a rounded number.
    const [bar] = stageBars([
      slice("deep", 91, 0.2534),
      slice("rem", 90, 0.2466),
      slice("core", 180, 0.5),
    ]).bars;
    expect(bar?.widthPercent).toBe((bar?.share ?? 0) * 100);
  });

  it("stops drawing the share the engine refused to state", () => {
    // A watch that reports deep sleep alone. The old width was
    // minutes / stagedMinutes — 90/90 — so the bar filled the whole track
    // under a sentence explaining that no percentage could be given.
    const bars = stageBars([slice("deep", 90, null)]);
    expect(bars.basis).toBe("none");
    expect(bars.bars.map((bar) => bar.widthPercent)).toEqual([null]);
    expect(bars.bars.map((bar) => bar.minutes)).toEqual([90]);
  });

  it("compares the stages that did arrive, against the largest of them", () => {
    // Not a claim about the night: deep and awake against each other, with the
    // panel saying in words what the bars are scaled to.
    const bars = stageBars([slice("deep", 60, null), slice("awake", 30, null)]);
    expect(bars.basis).toBe("reported");
    expect(bars.bars.map((bar) => bar.widthPercent)).toEqual([100, 50]);
    expect(bars.bars.every((bar) => bar.share === null)).toBe(true);
  });

  it("draws nothing when every reported stage is zero minutes", () => {
    const bars = stageBars([slice("deep", 0, null), slice("awake", 0, null)]);
    expect(bars.basis).toBe("none");
    expect(bars.bars.map((bar) => bar.widthPercent)).toEqual([null, null]);
  });

  it("orders the bars deepest first however the slices arrived", () => {
    const bars = stageBars([
      slice("awake", 20, null),
      slice("core", 200, null),
      slice("deep", 60, null),
    ]);
    expect(bars.bars.map((bar) => bar.stage)).toEqual(["deep", "core", "awake"]);
  });

  it("refuses the night basis when only some stages carry a share", () => {
    // The engine decides this for the whole night at once, so a mixed set can
    // only come from a caller that built one by hand. It must not be read as a
    // set of shares because most of it looks like one.
    const bars = stageBars([slice("deep", 90, 0.25), slice("rem", 90, null)]);
    expect(bars.basis).toBe("reported");
    expect(bars.bars.every((bar) => bar.share === null)).toBe(true);
  });

  it("has nothing to draw for a night with no stages at all", () => {
    expect(stageBars([])).toEqual({ basis: "none", bars: [] });
  });
});

describe("against a night the engine actually built", () => {
  const night = (rows: Partial<Record<"deep" | "rem" | "core" | "awake", number>>) =>
    buildSleepNight({
      rows: [
        {
          sample_on: "2026-09-07",
          source: "watch",
          sleep_hours: 7.5,
          sleep_deep_minutes: rows.deep ?? null,
          sleep_rem_minutes: rows.rem ?? null,
          sleep_core_minutes: rows.core ?? null,
          sleep_awake_minutes: rows.awake ?? null,
        },
      ],
      today: "2026-09-08",
    });

  it("reads a whole night as shares", () => {
    const built = night({ deep: 90, rem: 90, core: 240, awake: 30 });
    if (built.status !== "staged") throw new Error("expected a staged night");
    const bars = stageBars(built.slices);
    expect(bars.basis).toBe("night");
    // Every width is the share the engine published, and they cover the
    // staged minutes exactly once.
    const total = bars.bars.reduce((sum, bar) => sum + (bar.widthPercent ?? 0), 0);
    expect(Math.round(total)).toBe(100);
  });

  it("reads the partial night the sentence was written for", () => {
    // deep and awake only: `wholeNight` is false, so every share is null.
    const built = night({ deep: 60, awake: 30 });
    if (built.status !== "staged") throw new Error("expected a staged night");
    expect(built.slices.every((entry) => entry.share === null)).toBe(true);
    expect(stageBars(built.slices).basis).toBe("reported");
  });

  it("no longer scales a lone stage to the minutes it is the whole of", () => {
    // The arithmetic the panel used to draw with, spelled out: width was
    // `minutes / stagedMinutes * 100`, and for a source reporting deep sleep
    // alone that is the full track — the exact percentage the sentence
    // underneath said could not be given.
    const built = night({ deep: 90 });
    if (built.status !== "staged") throw new Error("expected a staged night");
    const [only] = built.slices;
    expect((only?.minutes ?? 0) / built.stagedMinutes).toBe(1);
    expect(stageBars(built.slices).bars.map((bar) => bar.widthPercent)).toEqual([null]);
  });
});
