import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { askFastTextAi } from "./ai-gateway.server";
import { parseAiJson } from "./ai-json.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LANGUAGE_NAMES, SupportedLanguageSchema } from "./language.schema";

const FridgeInput = z.object({
  ingredients: z.array(z.string().trim().min(1).max(120)).min(1).max(30),
  goal: z.string().trim().max(120).default("muscle_gain"),
  lang: SupportedLanguageSchema.default("lt"),
  kcalLeft: z.number().finite().min(0).max(20_000).optional(),
  proteinLeft: z.number().finite().min(0).max(1_000).optional(),
  variant: z.number().int().min(0).max(100).optional(),
});

const GeneratedRecipeSchema = z.object({
  title: z.string().trim().min(1).max(200),
  prepMinutes: z.coerce.number().int().min(1).max(240),
  calories: z.coerce.number().finite().min(0).max(10_000),
  protein: z.coerce.number().finite().min(0).max(1_000),
  carbs: z.coerce.number().finite().min(0).max(1_000),
  fat: z.coerce.number().finite().min(0).max(1_000),
  ingredientsUsed: z.array(z.string().trim().min(1).max(120)).min(1).max(30),
  instructions: z.array(z.string().trim().min(1).max(500)).min(1).max(12),
  tip: z.string().trim().min(1).max(500),
  missingSuggestion: z.string().trim().max(300).default(""),
});

const GeneratedRecipeResponseSchema = z.object({
  ok: z.literal(true),
  recipe: GeneratedRecipeSchema,
});

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

function toFridgeRecipe(recipe: z.infer<typeof GeneratedRecipeSchema>): FridgeRecipe {
  return {
    title: recipe.title,
    calories: recipe.calories,
    protein: recipe.protein,
    carbs: recipe.carbs,
    fat: recipe.fat,
    time: `${recipe.prepMinutes} min`,
    steps: recipe.instructions,
    usedIngredients: recipe.ingredientsUsed,
    missingSuggestion: recipe.missingSuggestion,
    coachNote: recipe.tip,
    fallback: false,
  };
}

function fallbackRecipe(data: z.infer<typeof FridgeInput>): FridgeRecipe {
  const lithuanian = data.lang === "lt";
  return {
    title: lithuanian
      ? "Greitas patiekalas iš jūsų ingredientų"
      : "Quick Dish From Your Ingredients",
    time: "20 min",
    calories: 520,
    protein: 38,
    carbs: 45,
    fat: 14,
    usedIngredients: data.ingredients,
    steps: [
      lithuanian ? "Paruoškite visus turimus ingredientus." : "Prep all ingredients.",
      lithuanian ? "Apkepkite baltymų šaltinį." : "Cook the protein source.",
      lithuanian
        ? "Sudėkite likusius ingredientus ir pagardinkite."
        : "Combine the remaining ingredients and season.",
    ],
    missingSuggestion: "",
    coachNote: lithuanian ? "Subalansuotas fitneso patiekalas." : "A balanced fitness meal.",
    fallback: true,
  };
}

export const generateFridgeRecipe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => FridgeInput.parse(data))
  .handler(async ({ data, context }): Promise<FridgeRecipe> => {
    const langName = LANGUAGE_NAMES[data.lang];
    const nutritionTarget = [
      data.kcalLeft != null ? `${Math.round(data.kcalLeft)} kcal likutis` : null,
      data.proteinLeft != null ? `${Math.round(data.proteinLeft)} g baltymų likutis` : null,
    ]
      .filter((value): value is string => value !== null)
      .join(", ");
    const prompt = `Tu esi profesionalus sporto virtuvės šefas ir dietologas.
Vartotojas šaldytuve turi šiuos ingredientus: ${data.ingredients.join(", ")}.
Tikslas: ${data.goal === "fat_loss" ? "svorio metimas (mažiau kalorijų)" : "raumenų auginimas (daug baltymų)"}.
${nutritionTarget ? `Dienos tikslas: ${nutritionTarget}.` : ""}
Sukurk kūrybišką, skanų ir lengvai pagaminamą patiekalą iš šių ingredientų. Varianto numeris: ${data.variant ?? 0}.
Visą tekstą pateik ${langName} kalba. Atsakyk TIK TIKSLIU JSON formatu be markdown:
{
  "ok": true,
  "recipe": {
    "title": "Patiekalo pavadinimas",
    "prepMinutes": 25,
    "calories": 550,
    "protein": 42,
    "carbs": 48,
    "fat": 15,
    "ingredientsUsed": ["Ingredientas 1", "Ingredientas 2"],
    "instructions": ["Paruoškite...", "Kepkite...", "Patiekite..."],
    "tip": "Trenerio patarimas dėl porcijos ir makroelementų",
    "missingSuggestion": "Nebūtinas, vienas papildomas ingredientas geresniam rezultatui"
  }
}`;

    try {
      const raw = await askFastTextAi({
        userId: context.userId,
        messages: [
          { role: "system", content: "Atsakyk TIK griežtu JSON formatu." },
          { role: "user", content: prompt },
        ],
        jsonMode: true,
        temperature: 0.2,
      });

      return toFridgeRecipe(parseAiJson(raw, GeneratedRecipeResponseSchema).recipe);
    } catch {
      return fallbackRecipe(data);
    }
  });
