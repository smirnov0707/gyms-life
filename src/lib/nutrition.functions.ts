import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const MealInput = z.object({
  description: z.string().min(2).max(400),
  lang: z.string().default("lt"),
});

export const logMeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => MealInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { generateJson } = await import("./ai-json.server");
    const { createAiRouterProvider } = await import("./ai-gateway.server");
    const gateway = createAiRouterProvider("nutrition.functions");

    const schema = z.object({
      food_name: z.string(),
      calories: z.number(),
      protein: z.number(),
      carbs: z.number(),
      fat: z.number(),
      note: z.string(),
    });

    const { LANG_NAMES } = await import("./plan-i18n.server");
    let parsed: z.infer<typeof schema> | null = null;
    try {
      parsed = await generateJson(gateway("google/gemini-3.1-flash-lite"), {
        system: `You are a precise sports nutritionist. Estimate macros for the described meal.
Respond in ${LANG_NAMES[data.lang] ?? "English"} for food_name and note.
Assume realistic portion sizes when not stated. Numbers are grams, calories are kcal for the WHOLE described meal.
note = max 1 short sentence with a practical tip for an athlete.`,
        prompt: data.description,
        schema,
      });
    } catch (error) {
      console.error("nutrition parse failed", error);
      parsed = null;
    }

    if (!parsed) {
      throw new Error(
        data.lang === "lt" ? "Nepavyko atpažinti patiekalo." : "Could not parse that meal.",
      );
    }

    const round = (n: number) => Math.max(0, Math.round(n));
    const row = {
      user_id: userId,
      description: data.description,
      food_name: parsed.food_name,
      calories: round(parsed.calories),
      protein: round(parsed.protein),
      carbs: round(parsed.carbs),
      fat: round(parsed.fat),
      note: parsed.note,
    };

    const { data: inserted } = await supabase
      .from("nutrition_logs")
      .insert(row)
      .select("*")
      .single();

    return inserted ?? row;
  });
