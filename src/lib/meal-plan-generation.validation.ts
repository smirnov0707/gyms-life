import type { GeneratedMealPlan } from "./meal-plan.schema";

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
  const invalidMealCount = plan.days.some((day) => day.meals.length !== requirements.mealsPerDay);
  if (invalidMealCount) {
    throw new Error("Generated meal plan does not contain the requested number of meals per day.");
  }

  const inconsistentDay = plan.days.find((day) => {
    const mealCalories = day.meals.reduce((total, meal) => total + meal.kcal, 0);
    return !isCloseTo(day.total_kcal, mealCalories, 0.15);
  });
  if (inconsistentDay) {
    throw new Error("Generated meal plan has inconsistent daily calorie totals.");
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
    throw new Error("Generated meal plan has inconsistent daily macro totals.");
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
    throw new Error("Generated meal plan has calories that do not match its macros.");
  }

  const incompleteRecipe = plan.days.some((day) =>
    day.meals.some((meal) => meal.ingredients.length === 0 || meal.steps.length === 0),
  );
  if (incompleteRecipe) {
    throw new Error("Generated meal plan contains an incomplete recipe.");
  }

  const fixedKcalTarget = requirements.fixedKcalTarget;
  if (fixedKcalTarget !== null && fixedKcalTarget !== undefined) {
    if (!isCloseTo(plan.kcal_target, fixedKcalTarget, 0.01)) {
      throw new Error("Generated meal plan does not match the requested calorie target.");
    }
    const offTargetDay = plan.days.find((day) => !isCloseTo(day.total_kcal, fixedKcalTarget, 0.1));
    if (offTargetDay) {
      throw new Error("Generated meal plan has a day outside the requested calorie target.");
    }
  }

  return plan;
}
