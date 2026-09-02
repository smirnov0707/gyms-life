import { describe, expect, it } from "vitest";
import { normalizeManualBodyMetric } from "./body-metric.schema";

describe("manual body metric domain", () => {
  it("normalizes localized decimal input before persistence", () => {
    expect(
      normalizeManualBodyMetric({
        weight_kg: " 83,456 ",
        body_fat: "17.895",
      }),
    ).toEqual({ weight_kg: 83.46, body_fat: 17.9 });
  });

  it("rejects empty, impossible, and non-finite measurements", () => {
    expect(() => normalizeManualBodyMetric({})).toThrow();
    expect(() => normalizeManualBodyMetric({ weight_kg: "0" })).toThrow();
    expect(() => normalizeManualBodyMetric({ body_fat: "101" })).toThrow();
    expect(() => normalizeManualBodyMetric({ weight_kg: "Infinity" })).toThrow();
  });
});
