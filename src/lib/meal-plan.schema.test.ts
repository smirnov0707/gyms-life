import { describe, expect, it } from "vitest";
import { parseStoredMealPlan } from "./meal-plan.schema";

const validMealPlan = {
  title: "7 day performance plan",
  summary: "Balanced nutrition for a strength block.",
  kcal_target: "2400",
  protein_target: "170",
  carbs_target: "250",
  fat_target: "75",
  hydration: "2.5 litres of water",
  prep_tips: ["Prepare protein portions in advance."],
  days: Array.from({ length: 7 }, (_, index) => ({
    day: String(index + 1),
    title: `Training day ${index + 1}`,
    total_kcal: "2400",
    total_protein: "170",
    total_carbs: "250",
    total_fat: "75",
    meals: [
      {
        slot: "Breakfast",
        name: "Oats and yoghurt",
        kcal: "600",
        protein: "40",
        carbs: "75",
        fat: "18",
        minutes: "10",
        ingredients: ["Oats 80 g", "Greek yoghurt 200 g"],
        steps: ["Combine the ingredients."],
        tip: "Add berries for fibre.",
      },
    ],
  })),
  shopping_list: [{ category: "Protein", items: [{ name: "Greek yoghurt", amount: "1 kg" }] }],
};

describe("stored meal plan validation", () => {
  it("normalizes valid database JSON into the meal-plan domain", () => {
    const plan = parseStoredMealPlan(validMealPlan);

    expect(plan?.kcal_target).toBe(2400);
    expect(plan?.days[0]?.day).toBe(1);
    expect(plan?.days[0]?.meals[0]?.minutes).toBe(10);
  });

  it("rejects incomplete persisted plans instead of trusting JSON casts", () => {
    expect(
      parseStoredMealPlan({ ...validMealPlan, days: validMealPlan.days.slice(0, 6) }),
    ).toBeNull();
    expect(
      parseStoredMealPlan({
        ...validMealPlan,
        days: validMealPlan.days.map((day) => ({ ...day, day: 1 })),
      }),
    ).toBeNull();
    expect(parseStoredMealPlan({ ...validMealPlan, title: "" })).toBeNull();
  });
});
