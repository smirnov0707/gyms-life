import { ObservedFailure } from "./observability.server";
import type { MealDay } from "./meal-plan.schema";
import { findKnownRecipeConflicts, type RecipePreferences } from "./meal-restrictions.engine";
export function assertKnownRecipeRestrictions(
  days: readonly MealDay[],
  preferences: RecipePreferences,
): void {
  if (findKnownRecipeConflicts(days, preferences).length)
    throw new ObservedFailure("meal_restriction_conflict", "MEAL_RESTRICTION_CONFLICT");
}
