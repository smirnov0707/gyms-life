import { describe, expect, it } from "vitest";
import { CHANGE_DIGITS, changeTone, regionChange } from "./change-map.model";

/**
 * The change map paints one region per body part, and the colour is what the
 * athlete reads at a glance. It used to give "we compared this and it held" and
 * "we could not compare this" the same faint grey, and its own legend said so:
 * "Estimate unchanged / unknown".
 */

describe("a region's change", () => {
  it("is a change when it moved", () => {
    expect(regionChange(4.2)).toEqual({ state: "changed", delta: 4.2 });
    expect(regionChange(-11)).toEqual({ state: "changed", delta: -11 });
  });

  it("is unchanged when it was compared and held", () => {
    expect(regionChange(0)).toEqual({ state: "unchanged" });
  });

  it("is absent when there was nothing to compare", () => {
    expect(regionChange(null)).toEqual({ state: "absent" });
  });

  it("treats a difference too small to print as no change", () => {
    // The tone came off the raw delta while the number beside it was rounded,
    // so four hundredths of a point painted the region green and printed
    // "+0 pp" underneath it.
    expect(regionChange(0.04)).toEqual({ state: "unchanged" });
    expect(regionChange(-0.04)).toEqual({ state: "unchanged" });
    expect(changeTone(regionChange(0.04))).toBe("neutral");
  });

  it("keeps a difference that does print", () => {
    expect(regionChange(0.06)).toEqual({ state: "changed", delta: 0.1 });
  });

  it("never produces a negative zero to print", () => {
    const change = regionChange(-0.001);
    expect(change).toEqual({ state: "unchanged" });
    // And when it does round to a value, that value is not -0 either.
    const tiny = regionChange(-0.04, CHANGE_DIGITS);
    expect(Object.is(tiny.state === "changed" ? tiny.delta : 0, -0)).toBe(false);
  });

  it("refuses a difference that is not a number", () => {
    expect(regionChange(Number.NaN)).toEqual({ state: "absent" });
    expect(regionChange(Number.POSITIVE_INFINITY)).toEqual({ state: "absent" });
  });
});

describe("the tone a region is painted in", () => {
  it("points up for a higher estimate and down for a lower one", () => {
    expect(changeTone(regionChange(3))).toBe("cool");
    expect(changeTone(regionChange(-3))).toBe("hot");
  });

  it("gives measured-and-steady its own colour, not the faint one", () => {
    // `muted` is drawn at a third of the opacity, and its own comment in the
    // body map says why: regions with nothing behind them stay quiet. A region
    // we did compare has something behind it.
    expect(changeTone(regionChange(0))).toBe("neutral");
    expect(changeTone(regionChange(0))).not.toBe(changeTone(regionChange(null)));
  });

  it("keeps the faint colour for the regions nobody could compare", () => {
    expect(changeTone(regionChange(null))).toBe("muted");
  });
});
