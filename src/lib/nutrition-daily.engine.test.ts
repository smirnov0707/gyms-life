import { describe, expect, it } from "vitest";
import {
  averageDailyTotal,
  dailyNutritionTotals,
  NUTRITION_LOG_READ_LIMIT,
  type NutritionLogEntry,
} from "./nutrition-daily.engine";

/**
 * The number this produces is sent to every personalized AI task as the
 * athlete's average intake. It was the average of a food-log row.
 */

const entry = (logged_on: string, calories: number, protein: number): NutritionLogEntry => ({
  logged_on,
  calories,
  protein,
});

describe("a day's intake", () => {
  it("is the sum of that day's entries, not one of them", () => {
    // The failure this file was written for. Five items of 400 kcal is a
    // 2000 kcal day; the state reported 400 and told the meal planner so.
    const days = dailyNutritionTotals([
      entry("2026-09-08", 400, 30),
      entry("2026-09-08", 400, 30),
      entry("2026-09-08", 400, 30),
      entry("2026-09-08", 400, 30),
      entry("2026-09-08", 400, 30),
    ]);
    expect(days).toEqual([{ day: "2026-09-08", calories: 2000, proteinG: 150 }]);
  });

  it("averages across days once each day is whole", () => {
    const days = dailyNutritionTotals([
      entry("2026-09-08", 1200, 90),
      entry("2026-09-08", 800, 60),
      entry("2026-09-07", 2200, 170),
    ]);
    expect(averageDailyTotal(days, (day) => day.calories)).toBe(2100);
    expect(averageDailyTotal(days, (day) => day.proteinG)).toBe(160);
  });

  it("agrees with the old arithmetic only when each day has one entry", () => {
    // Which is exactly what every fixture did, and why nothing caught this.
    const rows = [entry("2026-09-08", 2200, 160), entry("2026-09-07", 2000, 140)];
    const perRow = (2200 + 2000) / 2;
    expect(averageDailyTotal(dailyNutritionTotals(rows), (day) => day.calories)).toBe(perRow);
  });

  it("orders newest first", () => {
    const days = dailyNutritionTotals([
      entry("2026-09-06", 1000, 50),
      entry("2026-09-08", 1000, 50),
      entry("2026-09-07", 1000, 50),
    ]);
    expect(days.map((day) => day.day)).toEqual(["2026-09-08", "2026-09-07", "2026-09-06"]);
  });

  it("drops the oldest day when the read came back at its limit", () => {
    // Rows arrive newest first, so the boundary day is the only one that can
    // be half-present. Reporting it low would show a full day of eating as a
    // light one, and nothing downstream could tell.
    const rows = [
      entry("2026-09-08", 2000, 150),
      entry("2026-09-07", 2100, 160),
      entry("2026-09-06", 300, 20),
    ];
    expect(dailyNutritionTotals(rows, true).map((day) => day.day)).toEqual([
      "2026-09-08",
      "2026-09-07",
    ]);
    expect(dailyNutritionTotals(rows, false)).toHaveLength(3);
  });

  it("keeps a lone day even when truncated, rather than reporting nothing", () => {
    // Dropping it would turn a partial reading into no reading at all, and the
    // day count already says how little there is.
    expect(dailyNutritionTotals([entry("2026-09-08", 900, 60)], true)).toHaveLength(1);
  });

  it("ignores rows with no day or an unusable number", () => {
    const days = dailyNutritionTotals([
      entry("", 500, 40),
      entry("2026-09-08", Number.NaN, 40),
      entry("2026-09-08", 500, Number.POSITIVE_INFINITY),
      entry("2026-09-08", 500, 40),
    ]);
    expect(days).toEqual([{ day: "2026-09-08", calories: 500, proteinG: 40 }]);
  });

  it("has nothing to average when nothing was logged", () => {
    expect(dailyNutritionTotals([])).toEqual([]);
    expect(averageDailyTotal([], (day) => day.calories)).toBeNull();
  });

  it("reads enough rows that a normal fortnight cannot reach the bound", () => {
    // Fourteen days at forty entries a day. Stated so the number is a choice
    // rather than a leftover.
    expect(NUTRITION_LOG_READ_LIMIT).toBe(14 * 40);
  });
});
