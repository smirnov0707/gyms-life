import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { translateMealPlan } from "./meal-i18n.server";
import type { GeneratedMealPlan } from "./meal-types";

export const localizeMealPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        planId: z.string().uuid(),
        lang: z.enum(["lt", "en", "ru", "uk", "pl", "de", "es", "fr"]),
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

    const base = row.data as unknown as GeneratedMealPlan;
    const sourceLang = ((row as { lang?: string }).lang as string) || "lt";
    if (sourceLang === data.lang) return { plan: base };

    const cache = (((row as { i18n?: unknown }).i18n ?? {}) as Record<string, GeneratedMealPlan>);
    const cached = cache[data.lang];
    if (cached) return { plan: cached };

    const translated = await translateMealPlan("", base, data.lang);
    await supabase
      .from("meal_plans")
      .update({ i18n: { ...cache, [data.lang]: translated } as never })
      .eq("id", row.id)
      .eq("user_id", userId);

    return { plan: translated };
  });
