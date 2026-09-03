import { z } from "zod";
import { getExerciseMedia } from "./exercise-media";
import type { TrainingPlanData } from "./training-plan.schema";

/**
 * The subset of an exercise row that may cross from Supabase into an AI prompt
 * or a persisted, AI-generated plan. Rows are parsed individually so one bad
 * catalog record never makes the whole training experience unavailable.
 */
export const ExerciseCatalogItemSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Exercise slugs must be URL-safe."),
  name_en: z.string().trim().min(1).max(160),
  name_lt: z.string().trim().min(1).max(160),
  muscle_group: z.string().trim().min(1).max(80),
  equipment: z.string().trim().min(1).max(80),
  location: z.string().trim().min(1).max(40),
  difficulty: z.string().trim().min(1).max(40),
});

export type ExerciseCatalogItem = z.infer<typeof ExerciseCatalogItemSchema>;

/**
 * Returns only canonical catalog records with a technique demonstration that
 * the library can render. AI therefore cannot create a dead exercise link.
 */
export function parseDemonstratedExerciseCatalog(value: unknown): ExerciseCatalogItem[] {
  if (!Array.isArray(value)) return [];

  const seenSlugs = new Set<string>();
  return value.flatMap((row) => {
    const parsed = ExerciseCatalogItemSchema.safeParse(row);
    if (!parsed.success || !getExerciseMedia(parsed.data.slug).isAvailable) return [];
    if (seenSlugs.has(parsed.data.slug)) return [];
    seenSlugs.add(parsed.data.slug);
    return [parsed.data];
  });
}

export function formatExerciseCatalogForAi(catalog: Iterable<ExerciseCatalogItem>): string {
  return Array.from(
    catalog,
    (exercise) =>
      `${exercise.slug} | ${exercise.name_en} / ${exercise.name_lt} | ${exercise.muscle_group} | ${exercise.equipment} | ${exercise.location} | ${exercise.difficulty}`,
  ).join("\n");
}

function exerciseLookupKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * An AI response may reproduce a catalog name in the `slug` field (for
 * example, "Barbell Bench Press") even when it selected the correct exercise.
 * Resolve only exact canonical aliases; an unknown movement remains unknown and
 * is rejected by the caller's safety validation.
 */
export function canonicalizeGeneratedPlanExercises(
  plan: TrainingPlanData,
  catalog: readonly ExerciseCatalogItem[],
  language: "lt" | "en",
): TrainingPlanData {
  const aliases = new Map<string, ExerciseCatalogItem>();

  for (const exercise of catalog) {
    for (const alias of [exercise.slug, exercise.name_en, exercise.name_lt]) {
      const key = exerciseLookupKey(alias);
      const existing = aliases.get(key);
      if (existing === undefined) aliases.set(key, exercise);
      else if (existing.slug !== exercise.slug) aliases.delete(key);
    }
  }

  return {
    ...plan,
    days: plan.days.map((day) => ({
      ...day,
      exercises: day.exercises.map((exercise) => {
        const canonical =
          aliases.get(exerciseLookupKey(exercise.slug)) ??
          aliases.get(exerciseLookupKey(exercise.name));
        if (canonical === undefined) return exercise;

        return {
          ...exercise,
          slug: canonical.slug,
          name: language === "lt" ? canonical.name_lt : canonical.name_en,
        };
      }),
    })),
  };
}

type PlanCatalogConstraints = {
  equipment: readonly string[];
  location: string;
};

/**
 * Keep the AI contract small and relevant: it may choose only exercises the
 * member can use in the selected setting. If a legacy catalog has no matching
 * entries, retain the validated catalog instead of fabricating substitutions.
 */
export function selectPlanExerciseCatalog(
  catalog: readonly ExerciseCatalogItem[],
  constraints: PlanCatalogConstraints,
): ExerciseCatalogItem[] {
  const equipment = new Set(
    constraints.equipment.map((item) => (item === "bands" ? "band" : item)),
  );
  equipment.add("bodyweight");

  const matching = catalog.filter(
    (exercise) =>
      equipment.has(exercise.equipment) &&
      (constraints.location === "both" ||
        exercise.location === "both" ||
        exercise.location === constraints.location),
  );

  return matching.length >= 4 ? matching : [...catalog];
}
