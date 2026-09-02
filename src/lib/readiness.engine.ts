import { z } from "zod";

export const StoredDailyReadinessSchema = z.object({
  readiness_score: z.number().finite().min(0).max(100).nullable(),
  load_modifier: z.number().finite().min(0.5).max(1.1).nullable(),
});

export type StoredDailyReadiness = z.infer<typeof StoredDailyReadinessSchema>;

/** Maps a validated readiness score to a conservative, session-safe load modifier. */
export function loadModifierFor(score: number): number {
  const boundedScore = Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 70;
  if (boundedScore >= 85) return 1.05;
  if (boundedScore >= 70) return 1;
  if (boundedScore >= 55) return 0.9;
  if (boundedScore >= 40) return 0.8;
  return 0.65;
}

/**
 * Reads a daily check-in defensively. Corrupt or absent persisted data never
 * changes a workout: the safe default is the unmodified plan.
 */
export function resolveReadinessModifier(value: unknown): number {
  const parsed = StoredDailyReadinessSchema.safeParse(value);
  if (!parsed.success) return 1;
  if (parsed.data.load_modifier !== null) return parsed.data.load_modifier;
  if (parsed.data.readiness_score !== null) return loadModifierFor(parsed.data.readiness_score);
  return 1;
}

/** Sets adjusted for recovery, never below one working set. */
export function adaptSets(sets: number, modifier: number): number {
  const boundedModifier = Number.isFinite(modifier) ? Math.max(0.5, Math.min(1.1, modifier)) : 1;
  return Math.max(1, Math.round(sets * boundedModifier));
}
