import { z } from "zod";

/** Stable client-facing result for both AI and deterministic fridge recipes. */
export const FridgeRecipeSchema = z.object({
  title: z.string().trim().min(1).max(200),
  calories: z.number().finite().min(0).max(10_000),
  protein: z.number().finite().min(0).max(1_000),
  carbs: z.number().finite().min(0).max(1_000),
  fat: z.number().finite().min(0).max(1_000),
  time: z.string().trim().min(1).max(40),
  steps: z.array(z.string().trim().min(1).max(500)).min(1).max(12),
  usedIngredients: z.array(z.string().trim().min(1).max(120)).min(1).max(30),
  missingSuggestion: z.string().trim().max(300),
  coachNote: z.string().trim().min(1).max(500),
  fallback: z.boolean(),
});

export type FridgeRecipe = z.infer<typeof FridgeRecipeSchema>;
