import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { askFastTextAi } from "./ai-gateway.server";
import { parseAiJson } from "./ai-json.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RestaurantSearchInput = z.object({
  query: z.string().min(1),
  goal: z.string().default("muscle_gain"),
  lang: z.string().default("lt"),
});

const RestaurantDishSchema = z.object({
  name: z.string().trim().min(1).max(200),
  calories: z.coerce.number().finite().min(0).max(10_000),
  protein: z.coerce.number().finite().min(0).max(1_000),
  carbs: z.coerce.number().finite().min(0).max(1_000),
  fat: z.coerce.number().finite().min(0).max(1_000),
  recommendationReason: z.string().trim().min(1).max(500),
  fitScore: z.coerce.number().finite().min(0).max(100),
});

const RestaurantSearchSuccessSchema = z.object({
  ok: z.literal(true),
  canonicalRestaurantName: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(120),
  dishes: z.array(RestaurantDishSchema).min(1).max(6),
  coachTip: z.string().trim().min(1).max(500),
});

const RestaurantSearchFailureSchema = z.object({
  ok: z.literal(false),
  reason: z.string().trim().min(1).max(500),
});

export const RestaurantSearchResultSchema = z.discriminatedUnion("ok", [
  RestaurantSearchSuccessSchema,
  RestaurantSearchFailureSchema,
]);

export type RestaurantSearchResult = z.infer<typeof RestaurantSearchResultSchema>;

export const searchRestaurantDishes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => RestaurantSearchInput.parse(data))
  .handler(async ({ data }) => {
    const langName = data.lang === "lt" ? "lietuvių" : "anglų";
    const goalText =
      data.goal === "fat_loss"
        ? "svorio metimui (mažiau kalorijų, daug baltymų)"
        : data.goal === "muscle_gain"
          ? "raumenų auginimui (daug baltymų, geri angliavandeniai)"
          : "sveikam balansui";

    const prompt = `Tu esi profesionalus sporto dietologas ir restoranų meniu ekspertas.
Vartotojas įvedė restorano ar kavinės pavadinimą: "${data.query}".

UŽDUOTIS:
1. Pirmiausia atpažink ir ištaisyk bet kokią rašybos klaidą (pvz. "mcdonals" -> "McDonald's", "hesburer" -> "Hesburger", "subvay" -> "Subway", "cili pica" -> "Čili Pizza", "kfc" -> "KFC", "sushi" -> "Sushi Bar").
2. Parink 4 geriausius patiekalus iš to tinklo/tipo meniu, tinkančius ${goalText}.

Atsakyk TIK TIKSLIU JSON formatu be markdown:
{
  "ok": true,
  "canonicalRestaurantName": "Oficialus restorano pavadinimas",
  "category": "Greitas maistas / Restoranas / Kavinė",
  "dishes": [
    {
      "name": "Patiekalo pavadinimas",
      "calories": 480,
      "protein": 38,
      "carbs": 42,
      "fat": 14,
      "recommendationReason": "Priežastis, kodėl tinka sportininkui",
      "fitScore": 95
    }
  ],
  "coachTip": "Trenerio patarimas užsakymui"
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

      return parseAiJson(raw, RestaurantSearchResultSchema);
    } catch {
      return {
        ok: false,
        reason:
          data.lang === "lt" ? "Nepavyko apdoroti restorano užklausos." : "Failed to fetch menu.",
      };
    }
  });
