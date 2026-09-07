import { describe, expect, it } from "vitest";
import {
  COMPOSITION_WINDOW_DAYS,
  buildBodyComposition,
  toReading,
  type BodyMetricRow,
} from "./body-trend.engine";

const today = "2026-09-07";
const row = (day: string, weight: number | string | null, fat: number | string | null) =>
  ({ measured_on: day, weight_kg: weight, body_fat: fat }) satisfies BodyMetricRow;

describe("toReading", () => {
  it("derives fat and lean mass from one row's own two numbers", () => {
    expect(toReading(row("2026-09-02", 85, 20))).toEqual({
      day: "2026-09-02",
      weightKg: 85,
      bodyFatPercent: 20,
      fatMassKg: 17,
      leanMassKg: 68,
    });
  });

  it("reads the strings Postgres numerics arrive as", () => {
    expect(toReading(row("2026-09-02", "85", "20"))?.fatMassKg).toBe(17);
  });

  it("refuses a row missing either number", () => {
    // Weight from this morning and a body fat percentage from three weeks ago
    // describe two different bodies. Multiplying them produces a fat mass that
    // was never true on any day, so only a row carrying both counts.
    expect(toReading(row("2026-09-02", 85, null))).toBeNull();
    expect(toReading(row("2026-09-02", null, 20))).toBeNull();
  });

  it("refuses figures no body has", () => {
    expect(toReading(row("2026-09-02", 0, 20))).toBeNull();
    expect(toReading(row("2026-09-02", 85, 100))).toBeNull();
    expect(toReading(row("2026-09-02", 85, -1))).toBeNull();
  });
});

describe("buildBodyComposition", () => {
  it("separates a failed read from a body never measured", () => {
    expect(buildBodyComposition({ rows: null, today })).toEqual({ status: "unreadable" });
    expect(buildBodyComposition({ rows: [], today })).toEqual({ status: "none" });
  });

  it("reports a composition without inventing a direction of travel", () => {
    // This account's actual state: one measurement. It knows what the body is
    // and nothing at all about where it is going.
    const result = buildBodyComposition({ rows: [row("2026-09-02", 85, 20)], today });
    expect(result.status).toBe("single");
    if (result.status !== "single") throw new Error("expected a single reading");
    expect(result.latest).toMatchObject({ weightKg: 85, fatMassKg: 17, leanMassKg: 68 });
  });

  it("treats several readings on one day as one", () => {
    const result = buildBodyComposition({
      rows: [row("2026-09-02", 85, 20), row("2026-09-02", 84.8, 20)],
      today,
    });
    expect(result.status).toBe("single");
  });

  it("compares the newest reading with the oldest one in the window", () => {
    const result = buildBodyComposition({
      rows: [row("2026-08-20", 86.5, 22), row("2026-09-05", 85, 20)],
      today,
    });
    if (result.status !== "change") throw new Error("expected a change");
    expect(result.days).toBe(16);
    expect(result.weightKg).toBe(-1.5);
    // 86.5 × 22% = 19.03 kg fat → 85 × 20% = 17 kg fat.
    expect(result.fatMassKg).toBe(-2);
    expect(result.leanMassKg).toBe(0.5);
  });

  it("does not reach past the window for something to compare against", () => {
    // A reading from six months ago is not this month's starting point, and a
    // change measured against it would be labelled with the wrong period.
    expect(COMPOSITION_WINDOW_DAYS).toBe(30);
    const result = buildBodyComposition({
      rows: [row("2026-03-01", 92, 26), row("2026-09-05", 85, 20)],
      today,
    });
    expect(result.status).toBe("single");
  });

  it("ignores a row dated in the future", () => {
    const result = buildBodyComposition({
      rows: [row("2026-09-02", 85, 20), row("2026-12-01", 70, 10)],
      today,
    });
    expect(result.status).toBe("single");
    if (result.status !== "single") throw new Error("expected a single reading");
    expect(result.latest.day).toBe("2026-09-02");
  });
});
