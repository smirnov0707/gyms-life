import { describe, expect, it } from "vitest";
import { resolveBodyWeight } from "./body-weight.engine";

describe("resolveBodyWeight", () => {
  it("prefers what the athlete has weighed over what they once stated", () => {
    // The regression this pins: meal plans and micronutrient scans read only
    // `profiles.weight_kg`, so an athlete who had logged their way from 90 kg
    // to 82 kg was still being sized for 90.
    expect(resolveBodyWeight([{ weight_kg: 82 }], 90)).toEqual({
      weightKg: 82,
      source: "measured",
    });
  });

  it("skips measurements that carry no weight rather than reading them as zero", () => {
    // A body scan can record body fat without a weight, and a scale entry the
    // reverse, so the newest row is not always the newest weight.
    expect(resolveBodyWeight([{ weight_kg: null }, { weight_kg: 78.5 }], 90)).toEqual({
      weightKg: 78.5,
      source: "measured",
    });
  });

  it("falls back to the stated weight when nothing has been measured", () => {
    expect(resolveBodyWeight([], 74)).toEqual({ weightKg: 74, source: "stated" });
  });

  it("accepts the decimal strings Postgres returns for numeric columns", () => {
    expect(resolveBodyWeight([{ weight_kg: "81.40" }], null)).toEqual({
      weightKg: 81.4,
      source: "measured",
    });
  });

  it("reports no weight rather than inventing one", () => {
    expect(resolveBodyWeight([], null)).toEqual({ weightKg: null, source: null });
    expect(resolveBodyWeight([{ weight_kg: null }], undefined)).toEqual({
      weightKg: null,
      source: null,
    });
  });

  it("refuses a stored oddity that is not a usable body weight", () => {
    expect(resolveBodyWeight([{ weight_kg: 0 }], 80)).toEqual({ weightKg: 80, source: "stated" });
    expect(resolveBodyWeight([{ weight_kg: "not a number" }], null)).toEqual({
      weightKg: null,
      source: null,
    });
  });

  it("takes a scale reading over a newer guess from a photograph", () => {
    // The photo scan writes into the same column as the scale panel, and when
    // the athlete does not supply a weight the number is the vision model's
    // own. Sizing meals and hydration from that in preference to an actual
    // weighing three days earlier is the wrong way round.
    expect(
      resolveBodyWeight(
        [
          { weight_kg: 84, weight_source: "photo_estimate" },
          { weight_kg: 82, weight_source: "measured" },
        ],
        90,
      ),
    ).toEqual({ weightKg: 82, source: "measured" });
  });

  it("uses a photo estimate when that is all there is, and says so", () => {
    expect(resolveBodyWeight([{ weight_kg: 84, weight_source: "photo_estimate" }], 90)).toEqual({
      weightKg: 84,
      source: "photo_estimate",
    });
  });

  it("takes the most recent of several photo estimates", () => {
    expect(
      resolveBodyWeight(
        [
          { weight_kg: 84, weight_source: "photo_estimate" },
          { weight_kg: 86, weight_source: "photo_estimate" },
        ],
        null,
      ),
    ).toEqual({ weightKg: 84, source: "photo_estimate" });
  });

  it("treats a row with no recorded provenance as a weighing", () => {
    // Every row predates the scan recording its own provenance, and the manual
    // panel is the older and far more common path. Downgrading them all would
    // put a warning on numbers people did weigh.
    expect(resolveBodyWeight([{ weight_kg: 80, weight_source: null }], 90)).toEqual({
      weightKg: 80,
      source: "measured",
    });
  });
});
