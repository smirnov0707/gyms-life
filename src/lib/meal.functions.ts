import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const MealPlanInput = z.object({
  diet: z.string().default("any"),
  allergies: z.string().default(""),
  dislikes: z.string().default(""),
  mealsPerDay: z.coerce.number().min(2).max(6).default(4),
  budget: z.string().default("medium"),
  cookingLevel: z.string().default("intermediate"),
  kcalTarget: z.coerce.number().min(1000).max(6000).nullable().optional(),
  lang: z.string().default("lt"),
});

const num = (fallback: number) =>
  z.preprocess(
    (v) => (v === undefined || v === null || v === "" ? fallback : Number(v)),
    z.coerce.number().default(fallback),
  );

const text = (fallback = "") =>
  z.preprocess(
    (v) => (Array.isArray(v) ? v.join(" • ") : typeof v === "number" ? String(v) : v),
    z.string().default(fallback),
  );

const arrayStrings = () =>
  z.preprocess(
    (v) => (Array.isArray(v) ? v.map((x) => String(x)) : typeof v === "string" ? v.split("\n").filter(Boolean) : []),
    z.array(z.string()).default([]),
  );

export const generateMealPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => MealPlanInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "display_name, birth_year, gender, height_cm, weight_kg, target_weight_kg, goal, days_per_week, experience, limitations",
      )
      .eq("id", userId)
      .maybeSingle();

    const { generateJson } = await import("./ai-json.server");
    const { createAiRouterProvider } = await import("./ai-gateway.server");
    const gateway = createAiRouterProvider("meal.functions");

    const MealSchema = z.object({
      slot: text("Maitinimas"),
      name: text("Patiekalas"),
      kcal: num(400),
      protein: num(30),
      carbs: num(40),
      fat: num(15),
      minutes: num(20),
      ingredients: arrayStrings(),
      steps: arrayStrings(),
      tip: text(""),
    });

    const DaySchema = z.object({
      day: num(1),
      title: text("Diena"),
      total_kcal: num(2000),
      total_protein: num(140),
      total_carbs: num(200),
      total_fat: num(65),
      meals: z.array(MealSchema).default([]),
    });

    const partOneSchema = z.object({
      title: text("GYMS.LIFE 7 dienų mitybos planas"),
      summary: text("Individualiai subalansuotas mitybos planas tavo tikslui."),
      kcal_target: num(2200),
      protein_target: num(140),
      carbs_target: num(220),
      fat_target: num(70),
      hydration: text("2.5 - 3.0 l vandens per dieną"),
      prep_tips: arrayStrings(),
      days: z.array(DaySchema).default([]),
    });

    const partTwoSchema = z.object({
      days: z.array(DaySchema).default([]),
      shopping_list: z.array(
        z.object({
          category: text("Produktai"),
          items: z.array(z.object({ name: text(""), amount: text("") })).default([]),
        }),
      ).default([]),
    });

    const schema = partOneSchema.merge(
      z.object({
        shopping_list: partTwoSchema.shape.shopping_list,
      }),
    );

    const { LANG_NAMES } = await import("./plan-i18n.server");
    const language = LANG_NAMES[data.lang] ?? "English";
    const age = profile?.birth_year ? new Date().getFullYear() - profile.birth_year : null;

    const system = `You are an elite sports dietitian building a 7-day meal plan.
Write EVERYTHING (titles, recipes, ingredients, shopping list) in ${language}.
Rules:
${
      data.kcalTarget
        ? `- The user has chosen a fixed daily energy intake of ${data.kcalTarget} kcal. Every day's total_kcal MUST be close to ${data.kcalTarget}, and kcal_target MUST equal ${data.kcalTarget}.`
        : "- Compute realistic daily kcal from body data (Mifflin-St Jeor + activity) and goal."
    }
- Distribute macros across exactly ${data.mealsPerDay} meals per day.
- Each meal: ingredients with quantities and 2-3 brief steps.
- Respect diet (${data.diet}), allergies (${data.allergies || "none"}) and dislikes (${data.dislikes || "none"}).
- Return valid JSON only.`;

    const prompt = `Athlete profile: ${JSON.stringify({
      name: profile?.display_name ?? null,
      age,
      gender: profile?.gender ?? null,
      height_cm: profile?.height_cm ?? null,
      weight_kg: profile?.weight_kg ?? null,
      target_weight_kg: profile?.target_weight_kg ?? null,
      goal: profile?.goal ?? null,
      training_days_per_week: profile?.days_per_week ?? 3,
    })}
Preferences: ${JSON.stringify({
      diet: data.diet,
      allergies: data.allergies,
      dislikes: data.dislikes,
      meals_per_day: data.mealsPerDay,
      budget: data.budget,
      cooking: data.cookingLevel,
    })}`;

    const model = gateway("google/gemini-3.1-flash-lite");

    let parsed: z.infer<typeof schema> | null = null;
    try {
      const partOne = await generateJson(model, {
        system: `${system}\n- Return days 1, 2, 3 and 4 in "days".`,
        prompt,
        schema: partOneSchema,
      });

      let partTwo: z.infer<typeof partTwoSchema> | null = null;
      try {
        partTwo = await generateJson(model, {
          system: `${system}\n- Return days 5, 6 and 7 in "days", plus full "shopping_list" aggregated by category.`,
          prompt: `${prompt}\n\nDays 1-4 planned:\n${JSON.stringify(
            partOne.days.map((d) => ({ day: d.day, meals: d.meals.map((m) => m.name) })),
          )}`,
          schema: partTwoSchema,
        });
      } catch (err) {
        console.warn("PartTwo generation warning, constructing fallback shopping list", err);
      }

      const allDays = [...partOne.days, ...(partTwo?.days ?? [])]
        .filter((d, i, all) => all.findIndex((x) => x.day === d.day) === i)
        .sort((a, b) => a.day - b.day);

      // Fallback default shopping list if partTwo shopping list was empty
      const shoppingList = (partTwo?.shopping_list && partTwo.shopping_list.length > 0)
        ? partTwo.shopping_list
        : [
            {
              category: "Baltymai & Mėsa",
              items: [
                { name: "Vištienos krūtinėlė", amount: "1.2 kg" },
                { name: "Kiaušiniai", amount: "20 vnt." },
                { name: "Liesa varškė", amount: "800 g" },
                { name: "Lašišos filė", amount: "500 g" },
              ],
            },
            {
              category: "Daržovės & Vaisiai",
              items: [
                { name: "Špinatai ir brokoliai", amount: "600 g" },
                { name: "Bananai ir uogos", amount: "1 kg" },
                { name: "Avokadai", amount: "4 vnt." },
              ],
            },
            {
              category: "Kruopos & Riebalai",
              items: [
                { name: "Avižiniai dribsniai", amount: "500 g" },
                { name: "Ryžiai / grikiai", amount: "800 g" },
                { name: "Alyvuogių aliejus", amount: "1 vnt." },
              ],
            },
          ];

      parsed = {
        ...partOne,
        days: allDays.length >= 4 ? allDays : partOne.days,
        shopping_list: shoppingList,
      };
    } catch (error) {
      console.error("AI Meal plan generation failed", error);
      parsed = null;
    }

    if (!parsed || parsed.days.length === 0) {
      throw new Error(
        data.lang === "lt"
          ? "Nepavyko sugeneruoti mitybos plano. Bandykite dar kartą arba nurodykite konkretesnius pageidavimus."
          : "Could not generate the meal plan. Please try again.",
      );
    }

    await supabase
      .from("meal_plans")
      .update({ is_active: false })
      .eq("user_id", userId)
      .eq("is_active", true);

    const { data: inserted, error: insertErr } = await supabase
      .from("meal_plans")
      .insert({
        user_id: userId,
        title: parsed.title,
        goal: profile?.goal ?? null,
        diet: data.diet,
        allergies: data.allergies,
        dislikes: data.dislikes,
        kcal_target: Math.round(parsed.kcal_target),
        protein_target: Math.round(parsed.protein_target),
        carbs_target: Math.round(parsed.carbs_target),
        fat_target: Math.round(parsed.fat_target),
        is_active: true,
        lang: data.lang,
        i18n: {},
        data: parsed,
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("Supabase insert meal plan error:", insertErr);
    }

    await supabase
      .from("profiles")
      .update({
        diet: data.diet,
        allergies: data.allergies,
        dislikes: data.dislikes,
        meals_per_day: data.mealsPerDay,
      })
      .eq("id", userId);

    return { id: inserted?.id ?? null, plan: parsed };
  });
