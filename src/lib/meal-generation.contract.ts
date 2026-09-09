import { z } from "zod";
import {
  MealDaySchema,
  MealItemSchema,
  MEAL_PLAN_MAX_DAILY_KCAL,
  MEAL_PLAN_MIN_DAILY_KCAL,
} from "./meal-plan.schema";
const number = z.preprocess(
  (value) => (typeof value === "string" && value.trim() !== "" ? Number(value) : value),
  z.number().finite().nonnegative(),
);
export const RecipeGenerationSchema = MealItemSchema.extend({
  kcal: number.refine((value) => value > 0),
  protein: number,
  carbs: number,
  fat: number,
  minutes: number.refine((value) => Number.isInteger(value) && value <= 1440),
  ingredients: z.array(z.string().trim().min(1).max(300)).min(1).max(30),
  steps: z.array(z.string().trim().min(1).max(1000)).min(1).max(20),
});
export const RecipeDayGenerationSchema = MealDaySchema.extend({
  total_kcal: number.refine(
    (value) => value >= MEAL_PLAN_MIN_DAILY_KCAL && value <= MEAL_PLAN_MAX_DAILY_KCAL,
  ),
  total_protein: number,
  total_carbs: number,
  total_fat: number,
  meals: z.array(RecipeGenerationSchema).min(1).max(6),
});
/** Partial responses must cover their assigned days before any next call is paid for. */
export function recipePartSchema(days: readonly number[]) {
  return z
    .array(RecipeDayGenerationSchema)
    .length(days.length)
    .refine(
      (result) =>
        result.every((day) => days.includes(day.day)) &&
        new Set(result.map((day) => day.day)).size === days.length,
      "Generated part does not cover exactly its assigned days.",
    );
}
export const RECIPE_QUANTITY_INSTRUCTION =
  "For every ingredient use an explicit positive amount and unit: 'Ingredient 150 g', 'Milk alternative 200 ml', 'Eggs 2 pcs'. Amounts are for ONE athlete serving. Retain raw/dry/cooked/drained descriptors in the ingredient name. Only salt and pepper may use 'to taste'. Never invent a quantity from a label or package size. Return internally consistent meal calories and macros.";
