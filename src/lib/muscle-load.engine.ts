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
export const MUSCLE_LOAD_DECAY_TIME_CONSTANT_HOURS = 40;
/** Fatigue points contributed per ton (1000 kg) of fresh volume. */
export const MUSCLE_LOAD_VOLUME_FATIGUE_FACTOR = 7;

/**
 * Deterministic recent training load and recovery per muscle group, from
 * completed sets and the exercise-to-muscle-group lookup. No AI provider is
 * involved. `recoveryPct` is a calculated estimate (exponential fatigue
 * decay from logged volume), never a physiological measurement.
 *
 * Groups with incomplete or unsupported completed-set inputs are omitted so
 * the canonical Twin mapper can mark them unknown. Raw set logs are unchanged.
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
  if (!Number.isFinite(nowMs)) throw new RangeError("Muscle load requires a valid evaluation time");
  // Missing/unsupported load in a completed set invalidates the group's estimate,
  // not the athlete's raw log. A partial sum must not masquerade as full evidence.
  const unsupportedGroups = new Set<string>();

  for (const set of parsedSets) {
    if (set.done !== true) continue;
    const group = groupBySlug.get(set.exercise_slug);
    if (!group) continue;

    const performedMs = Date.parse(set.performed_at);
    // A future entry is not a past workout and must not be clamped to "just now".
    if (Number.isFinite(performedMs) && performedMs > nowMs) continue;
    const reps = set.reps;
    const weight = set.weight_kg;
    if (
      !Number.isFinite(performedMs) ||
      reps === null ||
      reps <= 0 ||
      weight === null ||
      weight <= 0
    ) {
      // Zero external weight is not zero effort: bodyweight/assisted/timed work
      // needs a different model. Do not invent a weight or a recovery percentage.
      unsupportedGroups.add(group);
      continue;
    }
    const volume = reps * weight;
    if (!Number.isFinite(volume) || volume > Number.MAX_SAFE_INTEGER) {
      unsupportedGroups.add(group);
      continue;
    }
    const hoursAgo = (nowMs - performedMs) / 3_600_000;

    const entry = byGroup.get(group) ?? { volume: 0, fatigue: 0, lastHours: null };
    entry.volume += volume;
    if (entry.volume > Number.MAX_SAFE_INTEGER) unsupportedGroups.add(group);
    entry.fatigue +=
      (volume / 1000) *
      Math.exp(-hoursAgo / MUSCLE_LOAD_DECAY_TIME_CONSTANT_HOURS) *
      MUSCLE_LOAD_VOLUME_FATIGUE_FACTOR;
    entry.lastHours = entry.lastHours === null ? hoursAgo : Math.min(entry.lastHours, hoursAgo);
    byGroup.set(group, entry);
  }

  return [...byGroup.entries()]
    .filter(([group]) => !unsupportedGroups.has(group))
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
