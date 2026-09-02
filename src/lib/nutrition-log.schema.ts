import { z } from "zod";

const FoodNameSchema = z.string().trim().min(1).max(200);
const NoteSchema = z.string().trim().max(500);

export const NutritionMacrosSchema = z.object({
  calories: z.coerce.number().finite().nonnegative().max(10_000),
  protein: z.coerce.number().finite().nonnegative().max(1_000),
  carbs: z.coerce.number().finite().nonnegative().max(1_000),
  fat: z.coerce.number().finite().nonnegative().max(1_000),
});

export const NutritionLogDraftSchema = NutritionMacrosSchema.extend({
  description: z.string().trim().min(2).max(400),
  food_name: FoodNameSchema,
  note: NoteSchema,
});

export type NutritionLogDraft = z.infer<typeof NutritionLogDraftSchema>;

/** Converts validated AI estimates into the integer values persisted in the log. */
export function normalizeNutritionLogDraft(value: unknown): NutritionLogDraft {
  const parsed = NutritionLogDraftSchema.parse(value);
  return {
    ...parsed,
    calories: Math.round(parsed.calories),
    protein: Math.round(parsed.protein),
    carbs: Math.round(parsed.carbs),
    fat: Math.round(parsed.fat),
  };
}
