import { describe, expect, it } from "vitest";
import { parseStoredMealPlan } from "./meal-plan.schema";
import { validateGeneratedMealPlan } from "./meal-plan-generation.validation";

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
        kcal: "2400",
        protein: "170",
        carbs: "250",
        fat: "75",
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
    expect(
      parseStoredMealPlan({
        ...validMealPlan,
        days: validMealPlan.days.map((day) => ({
          ...day,
          meals: day.meals.map((meal) => ({ ...meal, kcal: 0 })),
        })),
      }),
    ).toBeNull();
  });

  it("enforces the requested meal count and fixed daily calorie target", () => {
    const plan = parseStoredMealPlan(validMealPlan);
    expect(plan).not.toBeNull();
    if (!plan) return;

    expect(validateGeneratedMealPlan(plan, { mealsPerDay: 1, fixedKcalTarget: 2400 })).toBe(plan);
    expect(() =>
      validateGeneratedMealPlan(plan, { mealsPerDay: 2, fixedKcalTarget: 2400 }),
    ).toThrow("requested number of meals");
    expect(() =>
      validateGeneratedMealPlan(plan, { mealsPerDay: 1, fixedKcalTarget: 1800 }),
    ).toThrow("requested calorie target");
    expect(() =>
      validateGeneratedMealPlan(
        { ...plan, days: [{ ...plan.days[0]!, total_kcal: 1800 }, ...plan.days.slice(1)] },
        { mealsPerDay: 1, fixedKcalTarget: null },
      ),
    ).toThrow("inconsistent daily calorie totals");
  });

  it("rejects daily macro totals that do not add up to the meals", () => {
    const plan = parseStoredMealPlan(validMealPlan);
    expect(plan).not.toBeNull();
    if (!plan) return;

    expect(() =>
      validateGeneratedMealPlan(
        { ...plan, days: [{ ...plan.days[0]!, total_protein: 120 }, ...plan.days.slice(1)] },
        { mealsPerDay: 1, fixedKcalTarget: null },
      ),
    ).toThrow("inconsistent daily macro totals");
  });

  it("rejects calorie totals that contradict their macronutrients", () => {
    const plan = parseStoredMealPlan(validMealPlan);
    expect(plan).not.toBeNull();
    if (!plan) return;

    const firstDay = plan.days[0]!;
    expect(() =>
      validateGeneratedMealPlan(
        {
          ...plan,
          days: [
            {
              ...firstDay,
              total_kcal: 3000,
              meals: firstDay.meals.map((meal) => ({ ...meal, kcal: 3000 })),
            },
            ...plan.days.slice(1),
          ],
        },
        { mealsPerDay: 1, fixedKcalTarget: null },
      ),
    ).toThrow("calories that do not match its macros");
  });

  it("rejects meals without a usable recipe", () => {
    const plan = parseStoredMealPlan(validMealPlan);
    expect(plan).not.toBeNull();
    if (!plan) return;

    const firstDay = plan.days[0]!;
    expect(() =>
      validateGeneratedMealPlan(
        {
          ...plan,
          days: [
            {
              ...firstDay,
              meals: firstDay.meals.map((meal) => ({ ...meal, ingredients: [] })),
            },
            ...plan.days.slice(1),
          ],
        },
        { mealsPerDay: 1, fixedKcalTarget: null },
      ),
    ).toThrow("incomplete recipe");
  });
});
