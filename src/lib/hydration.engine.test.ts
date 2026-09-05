import { describe, expect, it } from "vitest";
import {
  HYDRATION_GENERIC_BASELINE_ML,
  HYDRATION_MAX_ML,
  HYDRATION_MIN_ML,
  calculateHydrationTarget,
} from "./hydration.engine";
import type { HydrationInput } from "./hydration.schema";

const base: HydrationInput = {
  bodyWeightKg: 80,
  bodyFatPct: null,
  trainingMinutesToday: 0,
  proteinGramsToday: null,
  supplementCategories: [],
};

const ml = (result: ReturnType<typeof calculateHydrationTarget>, key: string) =>
  result.components.find((component) => component.key === key)?.ml ?? null;

describe("calculateHydrationTarget", () => {
  it("derives the baseline from body mass", () => {
    const result = calculateHydrationTarget(base);
    expect(result.basis).toBe("personal");
    expect(ml(result, "baseline")).toBe(2640); // 80 × 33
    expect(result.targetMl).toBe(2650); // rounded to the nearest 50 ml
  });

  it("uses lean mass for the baseline when body fat is known", () => {
    // Water is held in lean tissue. 80 kg at 20% fat is 64 kg lean.
    const result = calculateHydrationTarget({ ...base, bodyFatPct: 20 });
    expect(ml(result, "baseline")).toBe(2624); // 64 × 41
    expect(result.components[0]?.inputs["leanKg"]).toBe(64);
    expect(result.components[0]?.inputs["bodyFatPct"]).toBe(20);
  });

  it("stays within a rounding step of the total-mass rule at average composition", () => {
    // The two rules must not disagree meaningfully for the person in the
    // middle, or knowing your body fat would appear to change your needs.
    const byWeight = calculateHydrationTarget(base);
    const byLean = calculateHydrationTarget({ ...base, bodyFatPct: 20 });
    expect(Math.abs(byLean.targetMl - byWeight.targetMl)).toBeLessThanOrEqual(50);
  });

  it("separates a lean body from a heavy one at the same weight", () => {
    const lean = calculateHydrationTarget({ ...base, bodyFatPct: 8 });
    const heavy = calculateHydrationTarget({ ...base, bodyFatPct: 40 });
    // Same 80 kg, very different lean mass, so a different requirement —
    // which the total-mass rule could not express at all.
    expect(lean.targetMl).toBeGreaterThan(heavy.targetMl);
    expect(ml(lean, "baseline")).toBe(3018); // 73.6 × 41
    expect(ml(heavy, "baseline")).toBe(1968); // 48 × 41
  });

  it("adds sweat replacement for the training actually logged today", () => {
    const result = calculateHydrationTarget({ ...base, trainingMinutesToday: 90 });
    expect(ml(result, "training")).toBe(750); // 1.5 h × 500
    expect(result.targetMl).toBe(3400);
  });

  it("adds the creatine and stimulant allowances only when those are taken", () => {
    const neither = calculateHydrationTarget(base);
    expect(ml(neither, "creatine")).toBeNull();
    expect(ml(neither, "stimulants")).toBeNull();

    const both = calculateHydrationTarget({
      ...base,
      supplementCategories: ["creatine", "preworkout", "omega"],
    });
    expect(ml(both, "creatine")).toBe(500);
    expect(ml(both, "stimulants")).toBe(250);
  });

  it("adds a protein allowance only on a genuinely high protein day", () => {
    const moderate = calculateHydrationTarget({ ...base, proteinGramsToday: 120 }); // 1.5 g/kg
    expect(ml(moderate, "protein")).toBeNull();

    const high = calculateHydrationTarget({ ...base, proteinGramsToday: 180 }); // 2.25 g/kg
    expect(ml(high, "protein")).toBe(250);
    expect(high.components.find((c) => c.key === "protein")?.inputs["perKg"]).toBe(2.3);
  });

  it("will not judge protein without a body mass to judge it against", () => {
    const result = calculateHydrationTarget({
      ...base,
      bodyWeightKg: null,
      proteinGramsToday: 300,
    });
    expect(ml(result, "protein")).toBeNull();
  });

  it("says the number is generic rather than passing a default off as theirs", () => {
    const result = calculateHydrationTarget({ ...base, bodyWeightKg: null });
    expect(result.basis).toBe("generic");
    expect(ml(result, "baseline")).toBe(HYDRATION_GENERIC_BASELINE_ML);
    expect(result.missingInputs).toContain("body_weight");
  });

  it("names every input it did not have", () => {
    const result = calculateHydrationTarget({
      bodyWeightKg: null,
      bodyFatPct: null,
      trainingMinutesToday: 0,
      proteinGramsToday: null,
      supplementCategories: [],
    });
    expect(result.missingInputs).toEqual(["body_weight", "training", "nutrition"]);
  });

  it("reports nothing missing once every input is present", () => {
    const result = calculateHydrationTarget({
      bodyWeightKg: 80,
      bodyFatPct: null,
      trainingMinutesToday: 60,
      proteinGramsToday: 150,
      supplementCategories: ["creatine"],
    });
    expect(result.missingInputs).toEqual([]);
  });

  it("reports a failed read separately from an absent one", () => {
    // Both leave the target generic, but only one of them is the athlete's
    // fault to fix — the other will correct itself.
    const absent = calculateHydrationTarget({ ...base, bodyWeightKg: null });
    expect(absent.readFailed).toBe(false);
    expect(absent.basis).toBe("generic");

    const failed = calculateHydrationTarget({ ...base, bodyWeightKg: null, readFailed: true });
    expect(failed.readFailed).toBe(true);
    expect(failed.basis).toBe("generic");
  });

  it("clamps to a safe range and says when it did", () => {
    // Drinking far past need is not harmless, so the ceiling is a safety
    // feature and the UI has to be able to explain the number it shows.
    const huge = calculateHydrationTarget({
      bodyWeightKg: 150,
      bodyFatPct: null,
      trainingMinutesToday: 240,
      proteinGramsToday: 400,
      supplementCategories: ["creatine", "preworkout"],
    });
    expect(huge.targetMl).toBe(HYDRATION_MAX_ML);
    expect(huge.cappedFromMl).toBeGreaterThan(HYDRATION_MAX_ML);

    const tiny = calculateHydrationTarget({ ...base, bodyWeightKg: 35 });
    expect(tiny.targetMl).toBe(HYDRATION_MIN_ML);
    expect(tiny.cappedFromMl).toBeNull();
  });

  it("flags electrolytes once the target is high", () => {
    expect(calculateHydrationTarget(base).electrolyteNote).toBe(false);
    expect(
      calculateHydrationTarget({
        bodyWeightKg: 95,
        bodyFatPct: null,
        trainingMinutesToday: 120,
        proteinGramsToday: null,
        supplementCategories: ["creatine"],
      }).electrolyteNote,
    ).toBe(true);
  });

  it("keeps the total equal to the components it reported", () => {
    const result = calculateHydrationTarget({
      bodyWeightKg: 82,
      bodyFatPct: null,
      trainingMinutesToday: 75,
      proteinGramsToday: 190,
      supplementCategories: ["creatine", "preworkout"],
    });
    const sum = result.components.reduce((total, component) => total + component.ml, 0);
    expect(Math.abs(result.targetMl - sum)).toBeLessThanOrEqual(25);
  });
});
