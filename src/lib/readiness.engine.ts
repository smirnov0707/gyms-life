import { z } from "zod";

export const StoredDailyReadinessSchema = z.object({
  readiness_score: z.number().finite().min(0).max(100).nullable(),
  load_modifier: z.number().finite().min(0.5).max(1.1).nullable(),
});

export type StoredDailyReadiness = z.infer<typeof StoredDailyReadinessSchema>;

/** The minimal self-reported inputs used by the deterministic daily readiness model. */
export const DailyReadinessFactorsSchema = z
  .object({
    sleepHours: z.number().finite().min(0).max(16),
    sleepQuality: z.number().int().min(1).max(5),
    soreness: z.number().int().min(1).max(5),
    stress: z.number().int().min(1).max(5),
    energy: z.number().int().min(1).max(5),
    mood: z.number().int().min(1).max(5),
  })
  .strict();

export type DailyReadinessFactors = z.infer<typeof DailyReadinessFactorsSchema>;

/** Scores only validated self-reported factors; it never calls an AI provider. */
export function calculateReadinessScore(value: DailyReadinessFactors): number {
  const input = DailyReadinessFactorsSchema.parse(value);
  const sleepPts = Math.max(0, Math.min(1, (input.sleepHours - 4) / 4)) * 30;
  const qualityPts = ((input.sleepQuality - 1) / 4) * 20;
  const sorenessPts = ((5 - input.soreness) / 4) * 20;
  const stressPts = ((5 - input.stress) / 4) * 10;
  const energyPts = ((input.energy - 1) / 4) * 15;
  const moodPts = ((input.mood - 1) / 4) * 5;
  return Math.round(sleepPts + qualityPts + sorenessPts + stressPts + energyPts + moodPts);
}

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
