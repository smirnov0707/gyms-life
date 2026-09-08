import { z } from "zod";

/**
 * The daily energy range a prescribed plan may fall in.
 *
 * These are not new numbers: they are the bounds the meal-plan request has
 * always placed on a target the athlete types in by hand. They live here so
 * that what a person may ask for and what a model may produce are one
 * definition rather than two, because they were two, and only one of them
 * existed.
 *
 * Deliberately a refusal rather than a clamp. Clamping a 700 kcal plan up to
 * 1000 leaves seven days of meals that still add to 700 under a header saying
 * 1000, which is a plan that lies about itself — and this file's other checks
 * exist precisely to stop that.
 */
export const MEAL_PLAN_MIN_DAILY_KCAL = 1000;
export const MEAL_PLAN_MAX_DAILY_KCAL = 6000;

const NonEmptyText = z.string().trim().min(1);
const MacroValue = z.coerce.number().finite().nonnegative();
const PositiveEnergyValue = z.coerce.number().finite().positive();

export const MealItemSchema = z.object({
  slot: NonEmptyText,
  name: NonEmptyText,
  kcal: PositiveEnergyValue,
  protein: MacroValue,
  carbs: MacroValue,
  fat: MacroValue,
  minutes: z.coerce.number().int().nonnegative(),
  ingredients: z.array(NonEmptyText),
  steps: z.array(NonEmptyText),
  tip: z.string(),
});

export const MealDaySchema = z.object({
  day: z.coerce.number().int().min(1).max(7),
  title: NonEmptyText,
  total_kcal: PositiveEnergyValue,
  total_protein: MacroValue,
  total_carbs: MacroValue,
  total_fat: MacroValue,
  meals: z.array(MealItemSchema).min(1),
});

export const ShoppingItemSchema = z.object({
  name: NonEmptyText,
  amount: NonEmptyText,
});

export const ShoppingGroupSchema = z.object({
  category: NonEmptyText,
  items: z.array(ShoppingItemSchema),
});

const SevenDistinctDaysSchema = z
  .array(MealDaySchema)
  .length(7)
  .refine(
    (days) => new Set(days.map((day) => day.day)).size === 7,
    "A seven-day meal plan must contain seven distinct days.",
  );

export const GeneratedMealPlanSchema = z.object({
  title: NonEmptyText,
  summary: z.string(),
  kcal_target: PositiveEnergyValue,
  protein_target: MacroValue,
  carbs_target: MacroValue,
  fat_target: MacroValue,
  hydration: NonEmptyText,
  prep_tips: z.array(z.string()),
  days: SevenDistinctDaysSchema,
  shopping_list: z.array(ShoppingGroupSchema),
  adapted_at: z.string().datetime().optional(),
  adapted_from_day: z.coerce.number().int().min(1).max(7).optional(),
  adaptation_note: z.string().optional(),
});

export const MealPlanTranslationCacheSchema = z.record(z.string(), GeneratedMealPlanSchema);

export type MealItem = z.infer<typeof MealItemSchema>;
export type MealDay = z.infer<typeof MealDaySchema>;
export type ShoppingItem = z.infer<typeof ShoppingItemSchema>;
export type ShoppingGroup = z.infer<typeof ShoppingGroupSchema>;
export type GeneratedMealPlan = z.infer<typeof GeneratedMealPlanSchema>;

/** Invalid persisted JSON is never allowed to become a UI or AI domain object. */
export function parseStoredMealPlan(value: unknown): GeneratedMealPlan | null {
  const parsed = GeneratedMealPlanSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
