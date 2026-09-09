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
        revision: z.string().datetime({ offset: true }).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("meal_plans")
      .select("id, data, lang, i18n, updated_at")
      .eq("id", data.planId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Meal plan not found");
    if (data.revision && data.revision !== row.updated_at) throw new Error("MEAL_PLAN_CHANGED");

    const base = GeneratedMealPlanSchema.safeParse(row.data);
    if (!base.success) throw new Error("Stored meal plan data is invalid");

    const sourceLang = row.lang || "lt";
    if (sourceLang === data.lang) return { plan: base.data, updatedAt: row.updated_at };

    const cache = MealPlanTranslationCacheSchema.safeParse(row.i18n);
    const translations = cache.success ? cache.data : {};
    const cached = translations[data.lang];
    if (cached) return { plan: cached, updatedAt: row.updated_at };

    const translated = await translateMealPlan(base.data, data.lang, userId);
    const { data: cachedRow, error: cacheError } = await supabase
      .from("meal_plans")
      .update({ i18n: serializeJson({ ...translations, [data.lang]: translated }) })
      .eq("id", row.id)
      .eq("user_id", userId)
      .eq("updated_at", row.updated_at)
      .select("updated_at")
      .maybeSingle();
    if (cacheError) throw new Error(`Could not cache translated meal plan: ${cacheError.message}`);

    if (!cachedRow) throw new Error("MEAL_PLAN_CHANGED");
    return { plan: translated, updatedAt: cachedRow.updated_at };
  });
