import type { GeneratedMealPlan } from "./meal-plan.schema";

type MealPlanGenerationRequirements = {
  mealsPerDay: number;
  fixedKcalTarget: number | null | undefined;
};

const isCloseTo = (actual: number, expected: number, relativeTolerance: number) =>
  Math.abs(actual - expected) <= Math.max(10, expected * relativeTolerance);

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
