import { describe, expect, it } from "vitest";
import {
  KCAL_PER_KG_BY_GOAL,
  KCAL_PER_KG_DEFAULT,
  MIN_CARBS_G,
  resolveNutritionTargets,
} from "./nutrition-targets.engine";

const none = {
  planKcal: null,
  planProteinG: null,
  planFatG: null,
  planCarbsG: null,
  bodyWeightKg: null,
  goal: null,
};

describe("resolveNutritionTargets", () => {
  it("uses the active meal plan when there is one", () => {
    // The plan is what the athlete agreed to, and it is what the coach
    // already reads — the screen must not show a different number.
    const result = resolveNutritionTargets({
      ...none,
      planKcal: 2400,
      planProteinG: 170,
      planFatG: 70,
      planCarbsG: 250,
      bodyWeightKg: 80,
      goal: "muscle",
    });

    expect(result).toEqual({
      basis: "meal_plan",
      kcal: 2400,
      proteinG: 170,
      fatG: 70,
      carbsG: 250,
      missing: [],
    });
  });

  it("estimates from body weight and goal when no plan exists", () => {
    const result = resolveNutritionTargets({ ...none, bodyWeightKg: 80, goal: "muscle" });
    expect(result.basis).toBe("estimated");
    expect(result.kcal).toBe(80 * KCAL_PER_KG_BY_GOAL["muscle"]!);
    expect(result.proteinG).toBe(160);
    expect(result.fatG).toBe(72);
    expect(result.missing).toEqual(["meal_plan"]);
  });

  it("varies the estimate by goal", () => {
    const lose = resolveNutritionTargets({ ...none, bodyWeightKg: 80, goal: "lose" });
    const muscle = resolveNutritionTargets({ ...none, bodyWeightKg: 80, goal: "muscle" });
    expect(lose.kcal).toBeLessThan(muscle.kcal!);
  });

  it("falls back to a neutral rate for an unrecognised goal", () => {
    const result = resolveNutritionTargets({ ...none, bodyWeightKg: 80, goal: "wandering" });
    expect(result.kcal).toBe(80 * KCAL_PER_KG_DEFAULT);
  });

  it("returns nothing rather than inventing a body", () => {
    // The screen used to assume 75 kg, producing a confident personal-looking
    // target for someone who had told us nothing about themselves.
    const result = resolveNutritionTargets(none);
    expect(result).toEqual({
      basis: "unavailable",
      kcal: null,
      proteinG: null,
      fatG: null,
      carbsG: null,
      missing: ["meal_plan", "body_weight"],
    });
  });

  it("ignores a plan with no calorie target instead of trusting the zero", () => {
    const result = resolveNutritionTargets({
      ...none,
      planKcal: 0,
      bodyWeightKg: 80,
      goal: "lose",
    });
    expect(result.basis).toBe("estimated");
  });

  it("keeps carbohydrate above the floor even on a very low estimate", () => {
    const result = resolveNutritionTargets({ ...none, bodyWeightKg: 40, goal: "lose" });
    expect(result.carbsG).toBeGreaterThanOrEqual(MIN_CARBS_G);
  });

  it("carries a plan's partial macros through as nulls, not zeros", () => {
    const result = resolveNutritionTargets({ ...none, planKcal: 2200, bodyWeightKg: 80 });
    expect(result.basis).toBe("meal_plan");
    expect(result.proteinG).toBeNull();
    expect(result.fatG).toBeNull();
  });
});
