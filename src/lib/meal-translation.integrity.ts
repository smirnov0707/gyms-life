import type { GeneratedMealPlan } from "./meal-plan.schema";
import { parseIngredientQuantity } from "./ingredient-quantity";
/** Only translated wording may change. Number and amount evidence must survive. */
export function assertTranslationStrings(
  source: readonly string[],
  translated: readonly string[],
): void {
  if (source.length !== translated.length) throw new Error("MEAL_TRANSLATION_INCOMPLETE");
  const numbers = (value: string) =>
    (value.match(/\d+(?:[.,]\d+)?|[½¼¾⅓⅔⅛⅜⅝⅞]/gu) ?? []).map((token) => token.replace(",", "."));
  for (let index = 0; index < source.length; index++) {
    const a = source[index]!,
      b = translated[index]!;
    if (
      Boolean(a.trim()) !== Boolean(b.trim()) ||
      JSON.stringify(numbers(a)) !== JSON.stringify(numbers(b))
    )
      throw new Error("MEAL_TRANSLATION_CHANGED_NUMBERS");
  }
}
export function assertMealTranslationStructure(
  source: GeneratedMealPlan,
  translated: GeneratedMealPlan,
): void {
  const numeric = (plan: GeneratedMealPlan) => ({
    targets: [plan.kcal_target, plan.protein_target, plan.carbs_target, plan.fat_target],
    days: plan.days.map((day) => ({
      day: day.day,
      totals: [day.total_kcal, day.total_protein, day.total_carbs, day.total_fat],
      meals: day.meals.map((meal) => ({
        numbers: [meal.kcal, meal.protein, meal.carbs, meal.fat, meal.minutes],
        ingredients: meal.ingredients.length,
        steps: meal.steps.length,
      })),
    })),
    groups: plan.shopping_list.map((group) => group.items.length),
    tips: plan.prep_tips.length,
    adaptation: [plan.adapted_at ?? null, plan.adapted_from_day ?? null],
  });
  if (JSON.stringify(numeric(source)) !== JSON.stringify(numeric(translated)))
    throw new Error("MEAL_TRANSLATION_CHANGED_STRUCTURE");
  for (let i = 0; i < source.days.length; i++)
    for (let j = 0; j < source.days[i]!.meals.length; j++) {
      const a = source.days[i]!.meals[j]!,
        b = translated.days[i]!.meals[j]!;
      a.ingredients.forEach((ingredient, k) => {
        const expected = parseIngredientQuantity(ingredient),
          actual = parseIngredientQuantity(b.ingredients[k]!);
        if (expected.qty !== null && (actual.qty !== expected.qty || actual.unit !== expected.unit))
          throw new Error("MEAL_TRANSLATION_CHANGED_QUANTITY");
      });
    }
}
