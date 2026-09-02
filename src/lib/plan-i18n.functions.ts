import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { translatePlanData } from "./plan-i18n.server";
import { serializeJson } from "./json.schema";
import { TrainingPlanDataSchema } from "./training-plan.schema";

const PlanTranslationCacheSchema = z.record(z.string(), TrainingPlanDataSchema);

export const localizePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
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
      .from("plans")
      .select("id, data, lang, i18n")
      .eq("id", data.planId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Plan not found");

    const base = TrainingPlanDataSchema.safeParse(row.data);
    if (!base.success) throw new Error("Stored plan data is invalid");

    const sourceLang = row.lang || "lt";
    if (sourceLang === data.lang) return { plan: base.data };

    const cache = PlanTranslationCacheSchema.safeParse(row.i18n);
    const translations = cache.success ? cache.data : {};
    const cached = translations[data.lang];
    if (cached) return { plan: cached };

    const translated = await translatePlanData(base.data, data.lang, userId);
    await supabase
      .from("plans")
      .update({ i18n: serializeJson({ ...translations, [data.lang]: translated }) })
      .eq("id", row.id)
      .eq("user_id", userId);

    return { plan: translated };
  });
