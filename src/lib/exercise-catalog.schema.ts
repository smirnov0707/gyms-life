import { z } from "zod";
import { getExerciseMedia } from "./exercise-media";

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
