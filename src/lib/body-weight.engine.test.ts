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
});
