import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { askFastTextAi } from "./ai-gateway.server";

const FridgeInput = z.object({
  ingredients: z.array(z.string()).min(1),
  goal: z.string().default("muscle_gain"),
  lang: z.string().default("lt"),
});

export const generateFridgeRecipe = createServerFn({ method: "POST" })
  .validator((data: unknown) => FridgeInput.parse(data))
  .handler(async ({ data }) => {
    const langName = data.lang === "lt" ? "lietuvių" : "anglų";
    const prompt = `Tu esi profesionalus sporto virtuvės šefas ir dietologas.
Vartotojas šaldytuve turi šiuos ingredientus: ${data.ingredients.join(", ")}.
Tikslas: ${data.goal === "fat_loss" ? "svorio metimas (mažiau kalorijų)" : "raumenų auginimas (daug baltymų)"}.

Sukurk kūrybišką, skanų ir lengvai pagaminamą patiekalą iš šių ingredientų.
Atsakyk TIK TIKSLIU JSON formatu be markdown:
{
  "ok": true,
  "recipe": {
    "title": "Patiekalo pavadinimas ${langName} kalba",
    "prepMinutes": 25,
    "calories": 550,
    "protein": 42,
    "carbs": 48,
    "fat": 15,
    "ingredientsUsed": ["Ingredientas 1", "Ingredientas 2"],
    "instructions": [
      "1. Paruoškite...",
      "2. Kepkite...",
      "3. Patiekite..."
    ],
    "tip": "Trenerio patarimas dėl porcijos ir makroelementų"
  }
}`;

    try {
      const raw = await askFastTextAi({
        messages: [
          { role: "system", content: "Atsakyk TIK griežtu JSON formatu." },
          { role: "user", content: prompt },
        ],
        jsonMode: true,
        temperature: 0.2,
      });

      const parsed = JSON.parse(
        raw
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim(),
      );
      if (parsed.recipe) return { ok: true, fallback: false, recipe: parsed.recipe };
      return parsed;
    } catch (err: any) {
      return {
        ok: false,
        fallback: true,
        recipe: {
          title:
            data.lang === "lt"
              ? "Greitas patiekalas iš jūsų ingredientų"
              : "Quick Dish From Your Ingredients",
          prepMinutes: 20,
          calories: 520,
          protein: 38,
          carbs: 45,
          fat: 14,
          ingredientsUsed: data.ingredients,
          instructions: [
            data.lang === "lt" ? "Paruoškite visus turimus ingredientus." : "Prep all ingredients.",
            data.lang === "lt" ? "Apkepkite baltymų šaltinį." : "Cook protein source.",
            data.lang === "lt"
              ? "Sudėkite likusius ingredientus ir pagardinkite."
              : "Combine and season.",
          ],
          tip: "Subalansuotas fitneso patiekalas.",
        },
      };
    }
  });
