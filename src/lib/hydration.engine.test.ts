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
      trainingMinutesToday: 0,
      proteinGramsToday: null,
      supplementCategories: [],
    });
    expect(result.missingInputs).toEqual(["body_weight", "training", "nutrition"]);
  });

  it("reports nothing missing once every input is present", () => {
    const result = calculateHydrationTarget({
      bodyWeightKg: 80,
      trainingMinutesToday: 60,
      proteinGramsToday: 150,
      supplementCategories: ["creatine"],
    });
    expect(result.missingInputs).toEqual([]);
  });

  it("clamps to a safe range and says when it did", () => {
    // Drinking far past need is not harmless, so the ceiling is a safety
    // feature and the UI has to be able to explain the number it shows.
    const huge = calculateHydrationTarget({
      bodyWeightKg: 150,
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
        trainingMinutesToday: 120,
        proteinGramsToday: null,
        supplementCategories: ["creatine"],
      }).electrolyteNote,
    ).toBe(true);
  });

  it("keeps the total equal to the components it reported", () => {
    const result = calculateHydrationTarget({
      bodyWeightKg: 82,
      trainingMinutesToday: 75,
      proteinGramsToday: 190,
      supplementCategories: ["creatine", "preworkout"],
    });
    const sum = result.components.reduce((total, component) => total + component.ml, 0);
    expect(Math.abs(result.targetMl - sum)).toBeLessThanOrEqual(25);
  });
});
