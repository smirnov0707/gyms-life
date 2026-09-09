import { z } from "zod";
import { SupportedLanguageSchema } from "./language.schema";
import { MEAL_PLAN_MIN_DAILY_KCAL, MEAL_PLAN_MAX_DAILY_KCAL } from "./meal-plan.schema";
export const MealDietSchema = z.enum([
  "any",
  "vegetarian",
  "vegan",
  "pescatarian",
  "low carb",
  "gluten free",
  "lactose free",
]);
export const MealPreferencesSchema = z.object({
  diet: MealDietSchema.default("any"),
  allergies: z.string().trim().max(500).default(""),
  dislikes: z.string().trim().max(500).default(""),
  mealsPerDay: z.coerce.number().int().min(2).max(6).default(4),
  budget: z.enum(["low", "medium", "high"]).default("medium"),
  cookingLevel: z
    .enum(["beginner, max 20 min", "intermediate", "advanced"])
    .default("intermediate"),
});
export const MealPlanInputSchema = MealPreferencesSchema.extend({
  kcalTarget: z
    .number()
    .finite()
    .int()
    .min(MEAL_PLAN_MIN_DAILY_KCAL)
    .max(MEAL_PLAN_MAX_DAILY_KCAL)
    .nullable()
    .optional(),
  lang: SupportedLanguageSchema.default("lt"),
});
export function mealPreferencesFromProfile(
  profile: {
    diet?: string | null;
    allergies?: string | null;
    dislikes?: string | null;
    meals_per_day?: number | null;
  } | null,
) {
  return MealPreferencesSchema.parse({
    diet: profile?.diet ?? "any",
    allergies: profile?.allergies ?? "",
    dislikes: profile?.dislikes ?? "",
    mealsPerDay: profile?.meals_per_day ?? 4,
  });
}
