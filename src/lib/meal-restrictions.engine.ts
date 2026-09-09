import type { MealDay } from "./meal-plan.schema";
import {
  FOOD_TERMS,
  MEAT_TERMS,
  HONEY_TERMS,
  type KnownFoodGroup,
} from "./meal-restrictions.lexicon";
const normalize = (value: string) =>
  value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[-‐‑]/g, " ");
function matches(text: string, terms: readonly string[]): boolean {
  const tokens = normalize(text).match(/[\p{L}]+/gu) ?? [];
  return terms.some((term) => {
    const words = normalize(term).split(" ");
    return tokens.some((_, start) =>
      words.every((word, offset) => {
        const token = tokens[start + offset];
        return (
          token !== undefined &&
          (word.endsWith("*") ? token.startsWith(word.slice(0, -1)) : token === word)
        );
      }),
    );
  });
}
function foodText(text: string, group: KnownFoodGroup): string {
  const normalized = normalize(text);
  // Remove the dairy noun only in explicit plant alternative names. The other
  // ingredient groups still inspect the original text (e.g. soy/almond milk).
  return group === "milk"
    ? normalized
        .replace(
          /\b(oat|soy|soya|almond|coconut|rice|pea|cashew|hemp) (milk|cream|yogurt|yoghurt)\b/gu,
          "$1 alternative",
        )
        .replace(
          /\b(avizu|soju|migdolu|kokosu|ryziu) (pienas|pieno|grietinele)\b/gu,
          "$1 alternative",
        )
        .replace(/\b(peanut|almond|cashew|sunflower) butter\b/gu, "$1 spread")
        .replace(/\b(zemes riesutu|migdolu|anakardziu) sviest[a-z]*\b/gu, "$1 spread")
    : normalized;
}
export type RecipeConflict = { day: number; meal: string; ingredient: string; restriction: string };
export type RecipePreferences = { diet: string; allergies: string; dislikes?: string };

/** Reports known positive text conflicts. An empty result is NOT safety approval. */
export function findKnownRecipeConflicts(
  days: readonly MealDay[],
  preferences: RecipePreferences,
): RecipeConflict[] {
  const restricted = (Object.keys(FOOD_TERMS) as KnownFoodGroup[]).filter((group) =>
    matches(preferences.allergies, FOOD_TERMS[group]),
  );
  if (
    matches(preferences.allergies, ["nuts", "riešutai", "riešutams", "орехи"]) &&
    !restricted.includes("peanuts")
  )
    restricted.push("peanuts");
  const result: RecipeConflict[] = [];
  for (const day of days)
    for (const meal of day.meals)
      for (const ingredient of meal.ingredients) {
        for (const group of restricted)
          if (matches(foodText(ingredient, group), FOOD_TERMS[group])) {
            result.push({ day: day.day, meal: meal.name, ingredient, restriction: group });
          }
        const diet = preferences.diet,
          text = normalize(ingredient);
        let conflict =
          ["vegan", "vegetarian", "pescatarian"].includes(diet) && matches(text, MEAT_TERMS);
        if (["vegan", "vegetarian"].includes(diet))
          conflict ||= ["fish", "crustaceans", "molluscs"].some((group) =>
            matches(text, FOOD_TERMS[group as KnownFoodGroup]),
          );
        if (diet === "vegan")
          conflict ||=
            matches(foodText(text, "milk"), FOOD_TERMS.milk) ||
            matches(text, FOOD_TERMS.eggs) ||
            matches(text, HONEY_TERMS);
        // Diet descriptors do not waive a declared allergy: lactose-free milk
        // still matches milk above; vegan wording never certifies absence of traces.
        if (diet === "gluten free" && !/gluten free|be glitimo|без глютена/u.test(text))
          conflict ||= matches(text, FOOD_TERMS.gluten);
        if (diet === "lactose free" && !/lactose free|be laktozes|без лактозы/u.test(text))
          conflict ||= matches(foodText(text, "milk"), FOOD_TERMS.milk);
        if (conflict) result.push({ day: day.day, meal: meal.name, ingredient, restriction: diet });
      }
  return result;
}
