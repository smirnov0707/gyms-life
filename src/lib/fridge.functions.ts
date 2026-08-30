import { isAiConfigured } from "./ai-gateway.server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const looseNum = z.coerce.number().catch(0);

const RecipeInput = z.object({
  ingredients: z.array(z.string().min(1)).min(1).max(25),
  lang: z.string().default("lt"),
  goal: z.string().default("muscle"),
  kcalLeft: looseNum.default(0),
  proteinLeft: looseNum.default(0),
  variant: looseNum.default(0),
});

const RecipeSchema = z.object({
  title: z.string().default(""),
  calories: looseNum.default(0),
  protein: looseNum.default(0),
  carbs: looseNum.default(0),
  fat: looseNum.default(0),
  time: z.string().default("20 min"),
  steps: z.array(z.string()).default([]),
  usedIngredients: z.array(z.string()).default([]),
  missingSuggestion: z.string().default(""),
  coachNote: z.string().default(""),
});

export const generateFridgeRecipe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RecipeInput.parse(input))
  .handler(async ({ data }) => {
    const { fallbackRecipe } = await import("./fridge.server");
    if (!isAiConfigured()) return fallbackRecipe(data.ingredients, data.lang);

    const { generateJson } = await import("./ai-json.server");
    const { createAiRouterProvider } = await import("./ai-gateway.server");
    const { LANG_NAMES } = await import("./plan-i18n.server");
    const gateway = createAiRouterProvider("fridge.functions");
    const language = LANG_NAMES[data.lang] ?? "English";

    const system = `You are a sports chef and nutritionist. Answer entirely in ${language}.

Create ONE realistic recipe using ONLY these ingredients (plus salt, pepper, spices, water, oil): ${data.ingredients.join(", ")}.
Never mention an ingredient that is not on the list.
Athlete goal: ${data.goal}. Remaining budget today: ${Math.round(data.kcalLeft)} kcal, ${Math.round(data.proteinLeft)} g protein. Keep the dish inside that budget when it is above zero.
Give 4-6 concrete steps with grams, temperature and time.
calories/protein/carbs/fat = numeric totals for the whole dish.
usedIngredients = the subset actually used. missingSuggestion = one ingredient worth adding next time. coachNote = one short sentence on how it fits the goal.
Recipe variation seed: ${data.variant} — produce a distinctly different dish for a different seed.

Return exactly: {"title":"","calories":0,"protein":0,"carbs":0,"fat":0,"time":"","steps":[""],"usedIngredients":[""],"missingSuggestion":"","coachNote":""}`;

    try {
      const r = await generateJson(gateway("google/gemini-3.1-flash-lite"), {
        system,
        prompt: `Ingredients: ${data.ingredients.join(", ")}. Seed ${data.variant}.`,
        schema: RecipeSchema,
        maxOutputTokens: 2200,
      });
      if (!r.title || r.steps.length === 0) return fallbackRecipe(data.ingredients, data.lang);
      return {
        title: r.title,
        calories: Math.round(r.calories),
        protein: Math.round(r.protein),
        carbs: Math.round(r.carbs),
        fat: Math.round(r.fat),
        time: r.time || "20 min",
        steps: r.steps.slice(0, 8),
        usedIngredients: r.usedIngredients.length ? r.usedIngredients : data.ingredients,
        missingSuggestion: r.missingSuggestion,
        coachNote: r.coachNote,
        fallback: false,
      };
    } catch {
      return fallbackRecipe(data.ingredients, data.lang);
    }
  });
