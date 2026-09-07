import { describe, expect, it } from "vitest";
import { buildTrainingLoad, type TrainingLoadSet } from "./training-load.engine";

const today = "2026-09-07";

/** Real calendar arithmetic, so the seven-day window is genuinely exercised. */
const shiftDay = (day: string, offset: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);
const dayOf = (instant: string) => {
  const parsed = Date.parse(instant);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : null;
};

const set = (day: string, weight: number | null, reps: number | null, done = true) =>
  ({
    performed_at: `${day}T12:00:00.000Z`,
    weight_kg: weight,
    reps,
    done,
  }) satisfies TrainingLoadSet;

const build = (sets: readonly TrainingLoadSet[] | null, coversLastWeek = true) =>
  buildTrainingLoad({ sets, today, dayOf, shiftDay, coversLastWeek });

describe("buildTrainingLoad", () => {
  it("sums weight times reps across the last seven days", () => {
    const load = build([set("2026-09-07", 100, 5), set("2026-09-05", 60, 10)]);
    expect(load).toMatchObject({ status: "counted", thisWeekKg: 1100, countedSets: 2 });
  });

  it("keeps last week separate, and reports the change against it", () => {
    const load = build([set("2026-09-06", 100, 10), set("2026-08-30", 100, 8)]);
    expect(load.status === "counted" && load.thisWeekKg).toBe(1000);
    expect(load.status === "counted" && load.lastWeekKg).toBe(800);
    expect(load.status === "counted" && load.changeFraction).toBeCloseTo(0.25);
  });

  it("withholds a change when the window did not reach last week", () => {
    // Not a comparison against zero: we simply did not look that far back.
    const load = build([set("2026-09-06", 100, 10)], false);
    expect(load.status === "counted" && load.lastWeekKg).toBeNull();
    expect(load.status === "counted" && load.changeFraction).toBeNull();
  });

  it("calls a first week a first week, not an infinite increase", () => {
    const load = build([set("2026-09-06", 100, 10)]);
    expect(load.status === "counted" && load.lastWeekKg).toBe(0);
    expect(load.status === "counted" && load.changeFraction).toBeNull();
  });

  it("counts a set it cannot turn into volume, rather than hiding it", () => {
    // Bodyweight work is real training. It is deliberately not estimated, so
    // it adds nothing to the total — but a total that quietly omits it would
    // understate the week without saying so.
    const load = build([set("2026-09-06", 100, 10), set("2026-09-06", null, 12)]);
    expect(load.status === "counted" && load.thisWeekKg).toBe(1000);
    expect(load.status === "counted" && load.countedSets).toBe(1);
    expect(load.status === "counted" && load.uncountedSets).toBe(1);
  });

  it("ignores sets that were never completed", () => {
    const load = build([set("2026-09-06", 100, 10, false)]);
    expect(load.status === "counted" && load.thisWeekKg).toBe(0);
    // Not completed is not "could not be counted": nothing was performed.
    expect(load.status === "counted" && load.uncountedSets).toBe(0);
  });

  it("returns seven days, oldest first, with the quiet ones at zero", () => {
    const load = build([set("2026-09-07", 50, 10)]);
    expect(load.status === "counted" && load.days).toHaveLength(7);
    expect(load.status === "counted" && load.days[0]?.day).toBe("2026-09-01");
    expect(load.status === "counted" && load.days[6]).toEqual({
      day: "2026-09-07",
      volumeKg: 500,
    });
    expect(load.status === "counted" && load.days[5]?.volumeKg).toBe(0);
  });

  it("refuses a set dated in the future and one dated before the window", () => {
    const load = build([set("2026-09-09", 100, 10), set("2026-08-01", 100, 10)]);
    expect(load.status === "counted" && load.thisWeekKg).toBe(0);
    expect(load.status === "counted" && load.lastWeekKg).toBe(0);
  });

  it("counts a set whose timestamp cannot be read, and places it nowhere", () => {
    const load = build([{ performed_at: "not a date", weight_kg: 100, reps: 10, done: true }]);
    expect(load.status === "counted" && load.thisWeekKg).toBe(0);
    expect(load.status === "counted" && load.uncountedSets).toBe(1);
  });

  it("tells an unread source from a week with no training", () => {
    expect(build(null)).toEqual({ status: "unreadable" });
    expect(build([]).status).toBe("counted");
  });
});
