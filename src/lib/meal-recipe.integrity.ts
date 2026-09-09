import type { MealDay } from "./meal-plan.schema";
import { parseIngredientQuantity, isToTasteIngredient } from "./ingredient-quantity";
import { ObservedFailure } from "./observability.server";

/** Internal arithmetic and usable instructions, not nutrient-database or allergy certification. */
export function assertMealRecipeIntegrity(
  days: readonly MealDay[],
  quantitiesRequired = false,
): void {
  for (const day of days)
    for (const meal of day.meals) {
      const energy = meal.protein * 4 + meal.carbs * 4 + meal.fat * 9;
      if (Math.abs(meal.kcal - energy) > Math.max(25, meal.kcal * 0.2))
        throw new ObservedFailure(
          "meal_energy_inconsistent",
          "A meal's calories contradict its macronutrients.",
        );
      if (!meal.ingredients.length || !meal.steps.length || meal.steps.some((step) => !step.trim()))
        throw new ObservedFailure(
          "incomplete_recipe",
          "Generated meal plan contains an incomplete recipe.",
        );
      if (
        quantitiesRequired &&
        meal.ingredients.some(
          (ingredient) =>
            parseIngredientQuantity(ingredient).qty === null && !isToTasteIngredient(ingredient),
        )
      )
        throw new ObservedFailure(
          "ingredient_quantity_missing",
          "A recipe ingredient has no unambiguous usable amount.",
        );
    }
}
export function assertMealTargetIntegrity(target: {
  kcal_target: number;
  protein_target: number;
  carbs_target: number;
  fat_target: number;
}): void {
  const energy = target.protein_target * 4 + target.carbs_target * 4 + target.fat_target * 9;
  if (Math.abs(target.kcal_target - energy) > Math.max(25, target.kcal_target * 0.2))
    throw new ObservedFailure(
      "target_macros_inconsistent",
      "Daily target calories contradict the macro targets.",
    );
}
