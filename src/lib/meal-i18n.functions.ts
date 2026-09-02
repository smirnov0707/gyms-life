import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { translateMealPlan } from "./meal-i18n.server";
import { serializeJson } from "./json.schema";
import { GeneratedMealPlanSchema, MealPlanTranslationCacheSchema } from "./meal-plan.schema";
import { SupportedLanguageSchema } from "./language.schema";

export const localizeMealPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        planId: z.string().uuid(),
        lang: SupportedLanguageSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("meal_plans")
      .select("id, data, lang, i18n")
      .eq("id", data.planId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Meal plan not found");

    const base = GeneratedMealPlanSchema.safeParse(row.data);
    if (!base.success) throw new Error("Stored meal plan data is invalid");

    const sourceLang = row.lang || "lt";
    if (sourceLang === data.lang) return { plan: base.data };

    const cache = MealPlanTranslationCacheSchema.safeParse(row.i18n);
    const translations = cache.success ? cache.data : {};
    const cached = translations[data.lang];
    if (cached) return { plan: cached };

    const translated = await translateMealPlan(base.data, data.lang, userId);
    const { error: cacheError } = await supabase
      .from("meal_plans")
      .update({ i18n: serializeJson({ ...translations, [data.lang]: translated }) })
      .eq("id", row.id)
      .eq("user_id", userId);
    if (cacheError) throw new Error(`Could not cache translated meal plan: ${cacheError.message}`);

    return { plan: translated };
  });
