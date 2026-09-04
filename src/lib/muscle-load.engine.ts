import { z } from "zod";
import {
  MuscleGroupLoadSchema,
  MuscleLoadExerciseSourceSchema,
  MuscleLoadSetSourceSchema,
  type MuscleGroupLoad,
  type MuscleLoadExerciseSource,
  type MuscleLoadSetSource,
} from "./muscle-load.schema";

/** Fatigue decays with this time constant. Change deliberately: it is user-visible. */
export const MUSCLE_LOAD_HALF_LIFE_HOURS = 40;
/** Fatigue points contributed per ton (1000 kg) of fresh volume. */
export const MUSCLE_LOAD_VOLUME_FATIGUE_FACTOR = 7;

/**
 * Deterministic recent training load and recovery per muscle group, from
 * completed sets and the exercise-to-muscle-group lookup. No AI provider is
 * involved. `recoveryPct` is a calculated estimate (exponential fatigue
 * decay from logged volume), never a physiological measurement.
 *
 * Sorted by recoveryPct ascending: most-fatigued groups first.
 */
export function calculateMuscleGroupLoad(
  sets: MuscleLoadSetSource[],
  exercises: MuscleLoadExerciseSource[],
  now = new Date(),
): MuscleGroupLoad[] {
  const parsedSets = z.array(MuscleLoadSetSourceSchema).parse(sets);
  const parsedExercises = z.array(MuscleLoadExerciseSourceSchema).parse(exercises);

  const groupBySlug = new Map<string, string>();
  for (const exercise of parsedExercises) groupBySlug.set(exercise.slug, exercise.muscle_group);

  const byGroup = new Map<string, { volume: number; fatigue: number; lastHours: number | null }>();
  const nowMs = now.getTime();

  for (const set of parsedSets) {
    if (set.done === false) continue;
    const group = groupBySlug.get(set.exercise_slug);
    if (!group) continue;

    const reps = set.reps ?? 0;
    const weight = set.weight_kg ?? 0;
    const volume = reps * weight;
    const hoursAgo = Math.max(0, (nowMs - new Date(set.created_at).getTime()) / 3_600_000);

    const entry = byGroup.get(group) ?? { volume: 0, fatigue: 0, lastHours: null };
    entry.volume += volume;
    entry.fatigue +=
      (volume / 1000) *
      Math.exp(-hoursAgo / MUSCLE_LOAD_HALF_LIFE_HOURS) *
      MUSCLE_LOAD_VOLUME_FATIGUE_FACTOR;
    entry.lastHours = entry.lastHours === null ? hoursAgo : Math.min(entry.lastHours, hoursAgo);
    byGroup.set(group, entry);
  }

  return [...byGroup.entries()]
    .map(([muscleGroup, value]) =>
      MuscleGroupLoadSchema.parse({
        muscleGroup,
        volumeKg: Math.round(value.volume),
        recoveryPct: Math.max(0, Math.min(100, Math.round(100 - value.fatigue))),
        lastTrainedHoursAgo: value.lastHours === null ? null : Math.round(value.lastHours),
      }),
    )
    .sort((a, b) => a.recoveryPct - b.recoveryPct);
}
