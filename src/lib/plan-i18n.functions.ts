import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { translatePlanData } from "./plan-i18n.server";
import type { PlanData } from "./plan-types";

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

    const base = row.data as unknown as PlanData;
    const sourceLang = (row.lang as string) || "lt";
    if (sourceLang === data.lang) return { plan: base };

    const cache = (row.i18n ?? {}) as Record<string, PlanData>;
    const cached = cache[data.lang];
    if (cached) return { plan: cached };

    const translated = await translatePlanData("", base, data.lang);
    await supabase
      .from("plans")
      .update({ i18n: { ...cache, [data.lang]: translated } as never })
      .eq("id", row.id)
      .eq("user_id", userId);

    return { plan: translated };
  });
