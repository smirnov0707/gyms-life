import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { PlanData } from "./plan-types";
import { serializeJson } from "./json.schema";
import {
  formatExerciseCatalogForAi,
  parseDemonstratedExerciseCatalog,
} from "./exercise-catalog.schema";
import { LANGUAGE_NAMES, SupportedLanguageSchema } from "./language.schema";
import { parseStoredTrainingPlan } from "./training-plan.schema";

const SuggestInput = z.object({
  goal: z.string().min(1).max(60),
  lang: SupportedLanguageSchema.default("lt"),
});

const num = (fallback: number) =>
  z.preprocess(
    (v) => (v === undefined || v === null || v === "" ? fallback : v),
    z.coerce.number().default(fallback),
  );

const SuggestionSchema = z.object({
  suggestions: z
    .array(
      z.object({
        slug: z.string(),
        name: z.string().default(""),
        reason: z.string().default(""),
        sets: num(3),
        reps: z.union([z.string(), z.number()]).default("8-12").transform(String),
        rest_seconds: num(90),
        muscle: z.string().default(""),
        priority: z.enum(["high", "medium", "low"]).default("medium"),
      }),
    )
    .default([]),
});

export type ExerciseSuggestion = {
  slug: string;
  name: string;
  reason: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  muscle: string;
  priority: "high" | "medium" | "low";
  inPlan: boolean;
};

/** AI picks catalog exercises that best serve the user's stated goal. */
export const suggestExercisesForGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => SuggestInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [{ data: profile }, { data: plans }, { data: exercises, error: exercisesError }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select(
            "experience, location, equipment, limitations, days_per_week, session_minutes, gender, weight_kg, height_cm",
          )
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("plans")
          .select("id, title, data")
          .eq("user_id", userId)
          .eq("is_active", true)
          .limit(1),
        supabase
          .from("exercises")
          .select("slug, name_lt, name_en, muscle_group, equipment, location, difficulty"),
      ]);

    const catalog = parseDemonstratedExerciseCatalog(exercises);
    if (exercisesError || catalog.length === 0) {
      throw new Error("Exercise catalog is unavailable. Please try again shortly.");
    }
    const activePlan = plans?.[0];
    const planData = activePlan ? parseStoredTrainingPlan(activePlan.data) : null;
    const planSlugs = new Set(
      (planData?.days ?? []).flatMap((d) => (d.exercises ?? []).map((e) => e.slug)),
    );

    const equipment = profile?.equipment ?? [];
    const allowed = catalog.filter(
      (e) =>
        (!equipment.length || equipment.includes(e.equipment) || e.equipment === "bodyweight") &&
        (!profile?.location ||
          profile.location === "both" ||
          e.location === "both" ||
          e.location === profile.location),
    );
    const pool = (allowed.length >= 20 ? allowed : catalog).slice(0, 400);

    const { generateJson } = await import("./ai-json.server");
    const { createAiRouterProvider } = await import("./ai-gateway.server");
    const gateway = createAiRouterProvider("exercise-suggest.functions");
    const langName = LANGUAGE_NAMES[data.lang];

    const prompt = `You are an elite strength coach recommending EXTRA exercises for a client's goal.

GOAL: ${data.goal}
Experience: ${profile?.experience ?? "beginner"} | Location: ${profile?.location ?? "gym"} | Equipment: ${equipment.join(", ") || "bodyweight"}
Limitations: ${profile?.limitations || "none"}
Already in the active plan (do NOT repeat these slugs): ${[...planSlugs].join(", ") || "nothing yet"}
Weak spots to consider: exercises that complement the plan and directly drive the goal.

CATALOG (slug | en / lt | muscle | equipment | location | difficulty)
${formatExerciseCatalogForAi(pool)}

RULES
- Return 6 suggestions, ordered best-first, using ONLY slugs copied exactly from the catalog.
- Never suggest a slug that is already in the active plan.
- Respect equipment, location and limitations.
- sets 2-5, reps a short string like "8-10" or "30-45 s", rest_seconds 45-180.
- "name" = exercise name in ${langName}. "reason" = ONE short sentence in ${langName} saying why it serves the goal.
- "muscle" = main muscle group in ${langName}. "priority" = high | medium | low.

RETURN JSON: {"suggestions":[{"slug":"","name":"","reason":"","sets":3,"reps":"8-10","rest_seconds":90,"muscle":"","priority":"high"}]}`;

    let out: z.infer<typeof SuggestionSchema>;
    try {
      out = await generateJson(gateway("google/gemini-3.1-flash-lite"), {
        userId,
        prompt,
        schema: SuggestionSchema,
        maxOutputTokens: 2000,
      });
    } catch {
      throw new Error("AI could not build suggestions. Please try again.");
    }

    const bySlug = new Map(catalog.map((e) => [e.slug, e]));
    const seen = new Set<string>();
    const suggestions: ExerciseSuggestion[] = out.suggestions
      .filter(
        (s) =>
          bySlug.has(s.slug) &&
          !planSlugs.has(s.slug) &&
          !seen.has(s.slug) &&
          seen.add(s.slug) !== undefined,
      )
      .slice(0, 6)
      .map((s) => {
        const row = bySlug.get(s.slug)!;
        return {
          slug: s.slug,
          name: s.name || (data.lang === "lt" ? row.name_lt : row.name_en),
          reason: s.reason,
          sets: Math.min(5, Math.max(2, Math.round(s.sets))),
          reps: s.reps,
          rest_seconds: Math.min(180, Math.max(45, Math.round(s.rest_seconds))),
          muscle: s.muscle || row.muscle_group,
          priority: s.priority,
          inPlan: false,
        };
      });

    return {
      suggestions,
      plan: activePlan
        ? {
            id: activePlan.id,
            title: planData?.title ?? activePlan.title,
            days: (planData?.days ?? []).map((d) => ({
              day: d.day,
              title: d.title,
              exercises: (d.exercises ?? []).length,
            })),
          }
        : null,
    };
  });

const AddInput = z.object({
  day: z.number().int().min(1).max(7),
  exercise: z.object({
    slug: z.string().min(1),
    name: z.string().min(1),
    sets: z.number().int().min(1).max(8),
    reps: z.string().min(1).max(20),
    rest_seconds: z.number().int().min(20).max(300),
    notes: z.string().max(300).optional(),
  }),
});

/** Appends a suggested exercise to a day of the user's active plan. */
export const addExerciseToActivePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => AddInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: plan } = await supabase
      .from("plans")
      .select("id, data")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (!plan) return { ok: false as const, reason: "no_plan" };

    const { data: exercise, error: exerciseError } = await supabase
      .from("exercises")
      .select("slug, name_lt, name_en, muscle_group, equipment, location, difficulty")
      .eq("slug", data.exercise.slug)
      .maybeSingle();
    if (exerciseError)
      throw new Error("Exercise catalog is unavailable. Please try again shortly.");
    if (parseDemonstratedExerciseCatalog(exercise ? [exercise] : []).length === 0) {
      return { ok: false as const, reason: "unavailable_exercise" };
    }

    const planData = parseStoredTrainingPlan(plan.data);
    if (!planData) return { ok: false as const, reason: "invalid_plan" };

    const days = planData.days;
    const index = days.findIndex((d) => d.day === data.day);
    if (index === -1) return { ok: false as const, reason: "no_day" };

    const day = days[index]!;
    if ((day.exercises ?? []).some((e) => e.slug === data.exercise.slug)) {
      return { ok: false as const, reason: "duplicate" };
    }

    const updated: PlanData = {
      ...planData,
      days: days.map((d, i) =>
        i === index
          ? {
              ...d,
              estimated_minutes:
                (d.estimated_minutes ?? 45) +
                Math.round((data.exercise.sets * (data.exercise.rest_seconds + 45)) / 60),
              exercises: [
                ...(d.exercises ?? []),
                { ...data.exercise, notes: data.exercise.notes ?? "" },
              ],
            }
          : d,
      ),
    };

    const { error } = await supabase
      .from("plans")
      .update({ data: serializeJson(updated) })
      .eq("id", plan.id);

    if (error) return { ok: false as const, reason: error.message };
    return { ok: true as const, dayTitle: day.title };
  });
