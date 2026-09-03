import { describe, expect, it } from "vitest";
import { normalizeManualBodyMetric, parseBodyMetrics } from "./body-metric.schema";

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

  it("excludes invalid persisted rows before they reach body-progress charts", () => {
    expect(
      parseBodyMetrics([
        {
          id: "f154ee80-6ae5-4a82-b629-c3c2119f6fd2",
          measured_on: "2026-09-03",
          weight_kg: 82.4,
          body_fat: 18.2,
          created_at: "2026-09-03T12:00:00+00:00",
        },
        {
          id: "6fd1a020-0df0-4c99-a383-07c9246e9c2d",
          measured_on: "2026-09-04",
          weight_kg: 0,
          body_fat: 18.1,
          created_at: "2026-09-04T12:00:00+00:00",
        },
      ]),
    ).toHaveLength(1);
  });
});
