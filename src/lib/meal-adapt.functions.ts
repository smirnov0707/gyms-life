import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const AdaptInput = z.object({
  fromDay: z.number().min(1).max(7),
  notes: z.string().max(500).default(""),
  lang: z.string().default("lt"),
});

/**
 * Re-plans the remaining days of the active meal plan using what the user
 * actually ate (nutrition logs), their preferences and current body data.
 */
export const adaptMealPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => AdaptInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: row } = await supabase
      .from("meal_plans")
      .select("id, data, diet, allergies, dislikes")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row?.data) {
      throw new Error(
        data.lang === "lt" ? "Aktyvaus mitybos plano nėra." : "No active meal plan found.",
      );
    }

    const since = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
    const [{ data: profile }, { data: logs }, { data: metrics }] = await Promise.all([
      supabase
        .from("profiles")
        .select("weight_kg, target_weight_kg, goal, days_per_week, meals_per_day")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("nutrition_logs")
        .select("logged_on, food_name, calories, protein, carbs, fat")
        .eq("user_id", userId)
        .gte("logged_on", since)
        .order("logged_on", { ascending: false })
        .limit(60),
      supabase
        .from("body_metrics")
        .select("measured_on, weight_kg")
        .eq("user_id", userId)
        .order("measured_on", { ascending: false })
        .limit(5),
    ]);

    const plan = row.data as Record<string, unknown> & {
      days: { day: number }[];
      kcal_target: number;
    };
    const remaining = plan.days.filter((d) => d.day >= data.fromDay).map((d) => d.day);
    if (!remaining.length) {
      throw new Error(
        data.lang === "lt" ? "Nėra likusių dienų koreguoti." : "No remaining days to adapt.",
      );
    }

    const { generateJson } = await import("./ai-json.server");
    const { createAiRouterProvider } = await import("./ai-gateway.server");
    const gateway = createAiRouterProvider("meal-adapt.functions");

    const MealSchema = z.object({
      slot: z.string(),
      name: z.string(),
      kcal: z.number(),
      protein: z.number(),
      carbs: z.number(),
      fat: z.number(),
      minutes: z.number(),
      ingredients: z.array(z.string()),
      steps: z.array(z.string()),
      tip: z.string(),
    });

    const schema = z.object({
      rationale: z.string(),
      kcal_target: z.number(),
      protein_target: z.number(),
      carbs_target: z.number(),
      fat_target: z.number(),
      days: z.array(
        z.object({
          day: z.number(),
          title: z.string(),
          total_kcal: z.number(),
          total_protein: z.number(),
          total_carbs: z.number(),
          total_fat: z.number(),
          meals: z.array(MealSchema),
        }),
      ),
      shopping_list: z.array(
        z.object({
          category: z.string(),
          items: z.array(z.object({ name: z.string(), amount: z.string() })),
        }),
      ),
    });

    const { LANG_NAMES } = await import("./plan-i18n.server");
    const language = LANG_NAMES[data.lang] ?? "English";

    const system = `You are an elite sports dietitian adapting an existing 7-day meal plan mid-week.
Write everything in ${language}.
Rules:
- Rewrite ONLY days ${remaining.join(", ")}. Keep the same day numbers and the same number of meals per day.
- Use the eaten-food log to see what the user actually eats: keep foods they repeat, drop ideas they clearly ignored, and compensate for macro gaps (e.g. if protein has been under target, raise protein on the remaining days).
- Adjust kcal/macro targets only if body-weight trend or the log justifies it; keep changes within +/-15% of the current target (${Math.round(plan.kcal_target)} kcal) and explain it in "rationale" (2-3 sentences).
- Respect diet, allergies and dislikes absolutely, plus the user's extra request.
- shopping_list = aggregated ingredients for the rewritten days ONLY, grouped by supermarket category.
- Numbers are plain numbers. No markdown.`;

    const prompt = `Current plan targets: ${JSON.stringify({
      kcal: plan.kcal_target,
      protein: (plan as { protein_target?: number }).protein_target,
      carbs: (plan as { carbs_target?: number }).carbs_target,
      fat: (plan as { fat_target?: number }).fat_target,
    })}
Days to rewrite: ${JSON.stringify(remaining)}
Existing days (for style + variety, do not repeat identical meals): ${JSON.stringify(plan.days).slice(0, 6000)}
Preferences: ${JSON.stringify({
      diet: row.diet,
      allergies: row.allergies,
      dislikes: row.dislikes,
      meals_per_day: profile?.meals_per_day ?? null,
    })}
Body: ${JSON.stringify({
      weight_kg: profile?.weight_kg ?? null,
      target_weight_kg: profile?.target_weight_kg ?? null,
      goal: profile?.goal ?? null,
      training_days: profile?.days_per_week ?? null,
      recent_weights: metrics ?? [],
    })}
What the user actually ate (last 3 days): ${JSON.stringify(logs ?? [])}
Extra request from user: ${data.notes || "-"}`;

    let parsed: z.infer<typeof schema> | null = null;
    try {
      parsed = await generateJson(gateway("google/gemini-3.1-flash-lite"), {
        userId,
        system,
        prompt,
        schema,
      });
    } catch (error) {
      console.error("AI JSON generation failed", error);
      parsed = null;
    }

    if (!parsed) {
      throw new Error(
        data.lang === "lt"
          ? "Nepavyko priderinti plano. Bandyk dar kartą."
          : "Could not adapt the plan. Please try again.",
      );
    }

    const byDay = new Map(parsed.days.map((d) => [d.day, d]));
    const mergedDays = plan.days.map((d) => byDay.get(d.day) ?? d);

    const updated = {
      ...plan,
      kcal_target: Math.round(parsed.kcal_target),
      protein_target: Math.round(parsed.protein_target),
      carbs_target: Math.round(parsed.carbs_target),
      fat_target: Math.round(parsed.fat_target),
      days: mergedDays,
      shopping_list: parsed.shopping_list,
      adapted_at: new Date().toISOString(),
      adapted_from_day: data.fromDay,
      adaptation_note: parsed.rationale,
    };

    await supabase
      .from("meal_plans")
      .update({
        data: updated,
        lang: data.lang,
        i18n: {},
        kcal_target: updated.kcal_target,
        protein_target: updated.protein_target,
        carbs_target: updated.carbs_target,
        fat_target: updated.fat_target,
      })
      .eq("id", row.id);

    return { plan: updated, rationale: parsed.rationale, days: remaining };
  });
