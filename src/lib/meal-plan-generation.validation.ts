import { ObservedFailure } from "./observability.server";
import {
  MEAL_PLAN_MAX_DAILY_KCAL,
  MEAL_PLAN_MIN_DAILY_KCAL,
  type GeneratedMealPlan,
} from "./meal-plan.schema";

type MealPlanGenerationRequirements = {
  mealsPerDay: number;
  fixedKcalTarget: number | null | undefined;
};

const isCloseTo = (actual: number, expected: number, relativeTolerance: number) =>
  Math.abs(actual - expected) <= Math.max(10, expected * relativeTolerance);

const caloriesFromMacros = (protein: number, carbs: number, fat: number) =>
  protein * 4 + carbs * 4 + fat * 9;

/**
 * Checks the rules that depend on the user's request rather than on the JSON
 * shape alone. It runs after Zod validation and before a generated plan is
 * stored or activated.
 */
export function validateGeneratedMealPlan(
  plan: GeneratedMealPlan,
  requirements: MealPlanGenerationRequirements,
): GeneratedMealPlan {
  // Every other check in this file is about a plan agreeing with itself, and
  // they are thorough: day totals match their meals, calories match macros,
  // and a requested target is honoured to one percent. None of them has an
  // opinion about the number itself. A plan at 700 kcal a day passes all of
  // them — the meals sum correctly, the macros are consistent, the recipes are
  // complete — and it is internally perfect and nutritionally dangerous.
  //
  // The gap only opens when the athlete has not fixed a target, which is the
  // ordinary path: the prompt then says "compute realistic daily kcal from body
  // data", and whatever comes back is what they are told to eat. A person may
  // not type a target below 1000 or above 6000. Until now a model could.
  const outOfRange = [plan.kcal_target, ...plan.days.map((day) => day.total_kcal)].find(
    (kcal) => kcal < MEAL_PLAN_MIN_DAILY_KCAL || kcal > MEAL_PLAN_MAX_DAILY_KCAL,
  );
  if (outOfRange !== undefined) {
    throw new ObservedFailure(
      "unsafe_energy_range",
      "Generated meal plan is outside the safe daily energy range.",
    );
  }

  const invalidMealCount = plan.days.some((day) => day.meals.length !== requirements.mealsPerDay);
  if (invalidMealCount) {
    throw new ObservedFailure(
      "meal_count",
      "Generated meal plan does not contain the requested number of meals per day.",
    );
  }

  const inconsistentDay = plan.days.find((day) => {
    const mealCalories = day.meals.reduce((total, meal) => total + meal.kcal, 0);
    return !isCloseTo(day.total_kcal, mealCalories, 0.15);
  });
  if (inconsistentDay) {
    throw new ObservedFailure(
      "day_calories_inconsistent",
      "Generated meal plan has inconsistent daily calorie totals.",
    );
  }

  const inconsistentMacros = plan.days.find((day) => {
    const mealProtein = day.meals.reduce((total, meal) => total + meal.protein, 0);
    const mealCarbs = day.meals.reduce((total, meal) => total + meal.carbs, 0);
    const mealFat = day.meals.reduce((total, meal) => total + meal.fat, 0);
    return (
      !isCloseTo(day.total_protein, mealProtein, 0.15) ||
      !isCloseTo(day.total_carbs, mealCarbs, 0.15) ||
      !isCloseTo(day.total_fat, mealFat, 0.15)
    );
  });
  if (inconsistentMacros) {
    throw new ObservedFailure(
      "day_macros_inconsistent",
      "Generated meal plan has inconsistent daily macro totals.",
    );
  }

  const energyMismatch = plan.days.find(
    (day) =>
      !isCloseTo(
        day.total_kcal,
        caloriesFromMacros(day.total_protein, day.total_carbs, day.total_fat),
        0.2,
      ),
  );
  if (energyMismatch) {
    throw new ObservedFailure(
      "calories_macros_mismatch",
      "Generated meal plan has calories that do not match its macros.",
    );
  }

  const incompleteRecipe = plan.days.some((day) =>
    day.meals.some((meal) => meal.ingredients.length === 0 || meal.steps.length === 0),
  );
  if (incompleteRecipe) {
    throw new ObservedFailure(
      "incomplete_recipe",
      "Generated meal plan contains an incomplete recipe.",
    );
  }

  const fixedKcalTarget = requirements.fixedKcalTarget;
  if (fixedKcalTarget !== null && fixedKcalTarget !== undefined) {
    if (!isCloseTo(plan.kcal_target, fixedKcalTarget, 0.01)) {
      throw new ObservedFailure(
        "target_not_met",
        "Generated meal plan does not match the requested calorie target.",
      );
    }
    const offTargetDay = plan.days.find((day) => !isCloseTo(day.total_kcal, fixedKcalTarget, 0.1));
    if (offTargetDay) {
      throw new ObservedFailure(
        "day_off_target",
        "Generated meal plan has a day outside the requested calorie target.",
      );
    }
  }

  const sum = (values: number[]) =>
    Math.round(values.reduce((total, value) => total + value, 0) * 10) / 10;
  const days = plan.days.map((day) => ({
    ...day,
    total_kcal: sum(day.meals.map((meal) => meal.kcal)),
    total_protein: sum(day.meals.map((meal) => meal.protein)),
    total_carbs: sum(day.meals.map((meal) => meal.carbs)),
    total_fat: sum(day.meals.map((meal) => meal.fat)),
  }));
  for (const day of days) {
    if (day.total_kcal < MEAL_PLAN_MIN_DAILY_KCAL || day.total_kcal > MEAL_PLAN_MAX_DAILY_KCAL)
      throw new ObservedFailure(
        "unsafe_energy_range",
        "Actual meal totals are outside the permitted range.",
      );
    if (fixedKcalTarget != null && !isCloseTo(day.total_kcal, fixedKcalTarget, 0.1))
      throw new ObservedFailure("day_off_target", "Actual meals do not match the chosen target.");
  }
  return { ...plan, days };
}
