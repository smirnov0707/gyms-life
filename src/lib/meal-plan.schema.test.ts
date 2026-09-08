import { describe, expect, it } from "vitest";
import {
  MEAL_PLAN_MAX_DAILY_KCAL,
  MEAL_PLAN_MIN_DAILY_KCAL,
  parseStoredMealPlan,
} from "./meal-plan.schema";
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

/**
 * Every other rule in the generation validator is about a plan agreeing with
 * itself, and they are thorough. None of them has an opinion about the number.
 * A plan at 700 kcal a day passes all of them.
 */
describe("the safe daily energy range", () => {
  const at = (kcal: number) => {
    const scale = kcal / 2400;
    const plan = parseStoredMealPlan({
      ...validMealPlan,
      kcal_target: String(kcal),
      protein_target: String(Math.round(170 * scale)),
      carbs_target: String(Math.round(250 * scale)),
      fat_target: String(Math.round(75 * scale)),
      days: validMealPlan.days.map((day) => ({
        ...day,
        total_kcal: String(kcal),
        total_protein: String(Math.round(170 * scale)),
        total_carbs: String(Math.round(250 * scale)),
        total_fat: String(Math.round(75 * scale)),
        meals: day.meals.map((meal) => ({
          ...meal,
          kcal: String(kcal),
          protein: String(Math.round(170 * scale)),
          carbs: String(Math.round(250 * scale)),
          fat: String(Math.round(75 * scale)),
        })),
      })),
    });
    if (!plan) throw new Error(`fixture at ${kcal} kcal did not parse`);
    return plan;
  };

  it("refuses a plan below the floor a person is allowed to ask for", () => {
    // The dangerous case, and the one that reaches an athlete: with no fixed
    // target the prompt says "compute realistic daily kcal from body data",
    // and whatever comes back is what they are told to eat.
    expect(() =>
      validateGeneratedMealPlan(at(700), { mealsPerDay: 1, fixedKcalTarget: null }),
    ).toThrow("safe daily energy range");
  });

  it("refuses a plan above the ceiling", () => {
    expect(() =>
      validateGeneratedMealPlan(at(9000), { mealsPerDay: 1, fixedKcalTarget: null }),
    ).toThrow("safe daily energy range");
  });

  it("accepts a plan inside the range", () => {
    const plan = at(2400);
    expect(validateGeneratedMealPlan(plan, { mealsPerDay: 1, fixedKcalTarget: null })).toBe(plan);
    expect(
      validateGeneratedMealPlan(at(MEAL_PLAN_MIN_DAILY_KCAL), {
        mealsPerDay: 1,
        fixedKcalTarget: null,
      }),
    ).toBeTruthy();
    expect(
      validateGeneratedMealPlan(at(MEAL_PLAN_MAX_DAILY_KCAL), {
        mealsPerDay: 1,
        fixedKcalTarget: null,
      }),
    ).toBeTruthy();
  });

  it("checks the range before the internal-consistency rules can pass it", () => {
    // A 700 kcal plan is internally perfect: its meals sum correctly, its
    // macros match its calories, its recipes are complete. That is exactly why
    // the range check has to exist separately.
    const starved = at(700);
    const mealCalories = starved.days[0]?.meals.reduce((sum, meal) => sum + meal.kcal, 0);
    expect(mealCalories).toBe(starved.days[0]?.total_kcal);
  });

  it("still parses a stored plan outside the range, so old data stays readable", () => {
    // The bound belongs to generation, not to the shape. Tightening the schema
    // would make a plan already in somebody's account unreadable, which turns
    // a safety fix into data loss.
    expect(parseStoredMealPlan({ ...validMealPlan, kcal_target: "700" })).not.toBeNull();
  });
});
