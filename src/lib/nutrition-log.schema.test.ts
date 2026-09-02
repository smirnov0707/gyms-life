import { describe, expect, it } from "vitest";
import { normalizeNutritionLogDraft } from "./nutrition-log.schema";

describe("nutrition log domain", () => {
  it("normalizes bounded macro estimates before persistence", () => {
    expect(
      normalizeNutritionLogDraft({
        description: "  Chicken and rice  ",
        food_name: "  Chicken bowl ",
        calories: 650.6,
        protein: 45.2,
        carbs: 70.8,
        fat: 16.1,
        note: "  Good post-workout meal. ",
      }),
    ).toEqual({
      description: "Chicken and rice",
      food_name: "Chicken bowl",
      calories: 651,
      protein: 45,
      carbs: 71,
      fat: 16,
      note: "Good post-workout meal.",
    });
  });

  it("rejects impossible estimates", () => {
    expect(() =>
      normalizeNutritionLogDraft({
        description: "Meal",
        food_name: "Meal",
        calories: 10_001,
        protein: 20,
        carbs: 20,
        fat: 10,
        note: "",
      }),
    ).toThrow();
  });
});
