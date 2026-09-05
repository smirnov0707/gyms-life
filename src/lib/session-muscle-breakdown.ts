import { z } from "zod";
import {
  MuscleLoadExerciseSourceSchema,
  type MuscleLoadExerciseSource,
} from "./muscle-load.schema";

/**
 * What one workout session actually worked, per muscle group.
 *
 * This is measurement, not estimation: it is the volume of the sets that were
 * logged, attributed through the exercise catalogue. Nothing here is decayed,
 * predicted or modelled — `muscle-load.engine` does that separately for
 * recovery over a window. Keep the two apart; they answer different questions.
 */

/** A completed set of this session, as selected in `finish-workout`. */
export const SessionSetSourceSchema = z
  .object({
    exercise_slug: z.string().min(1),
    reps: z.number().finite().nullable(),
    weight_kg: z.number().finite().nullable(),
    done: z.boolean().nullable(),
  })
  .strict();

export type SessionSetSource = z.infer<typeof SessionSetSourceSchema>;

export const SessionMuscleContributionSchema = z
  .object({
    muscleGroup: z.string().min(1),
    volumeKg: z.number().nonnegative(),
    sets: z.number().int().positive(),
    /**
     * This group's share of the session's total volume, 0–1.
     *
     * Null when the session moved no external load at all — a bodyweight or
     * cardio session has a real set count but no volume to take a share of,
     * and dividing by zero to produce a number would invent one.
     */
    shareOfSession: z.number().min(0).max(1).nullable(),
  })
  .strict();

export type SessionMuscleContribution = z.infer<typeof SessionMuscleContributionSchema>;

/**
 * Attributes a session's logged sets to muscle groups, heaviest first.
 *
 * A set whose exercise is not in the catalogue is skipped rather than
 * guessed at: we would have no basis for placing its load on any group.
 */
export function buildSessionMuscleBreakdown(
  sets: SessionSetSource[],
  exercises: MuscleLoadExerciseSource[],
): SessionMuscleContribution[] {
  const parsedSets = z.array(SessionSetSourceSchema).parse(sets);
  const parsedExercises = z.array(MuscleLoadExerciseSourceSchema).parse(exercises);

  const groupBySlug = new Map<string, string>();
  for (const exercise of parsedExercises) groupBySlug.set(exercise.slug, exercise.muscle_group);

  const byGroup = new Map<string, { volume: number; sets: number }>();
  for (const set of parsedSets) {
    if (set.done === false) continue;
    const group = groupBySlug.get(set.exercise_slug);
    if (!group) continue;

    const volume = (set.reps ?? 0) * (set.weight_kg ?? 0);
    const entry = byGroup.get(group) ?? { volume: 0, sets: 0 };
    entry.volume += volume;
    entry.sets += 1;
    byGroup.set(group, entry);
  }

  const totalVolume = [...byGroup.values()].reduce((sum, entry) => sum + entry.volume, 0);

  return [...byGroup.entries()]
    .map(([muscleGroup, entry]) =>
      SessionMuscleContributionSchema.parse({
        muscleGroup,
        volumeKg: Math.round(entry.volume),
        sets: entry.sets,
        shareOfSession:
          totalVolume > 0 ? Math.round((entry.volume / totalVolume) * 100) / 100 : null,
      }),
    )
    .sort(
      (a, b) =>
        b.volumeKg - a.volumeKg || b.sets - a.sets || a.muscleGroup.localeCompare(b.muscleGroup),
    );
}

/**
 * How loudly a group should read on the figure, from its share of the
 * session. Deliberately its own scale: the Twin's recovery bands answer
 * "how recovered is this?", these answer "how much of today landed here?".
 */
export const SESSION_STIMULUS_PRIMARY_SHARE = 0.3;
export const SESSION_STIMULUS_SECONDARY_SHARE = 0.1;

export type SessionStimulus = "primary" | "secondary" | "light" | "none";

export function stimulusFor(contribution: SessionMuscleContribution): SessionStimulus {
  // A session with no external load still worked the groups it worked; rank
  // them all as light rather than claiming a share we cannot compute.
  if (contribution.shareOfSession === null) return "light";
  if (contribution.shareOfSession >= SESSION_STIMULUS_PRIMARY_SHARE) return "primary";
  if (contribution.shareOfSession >= SESSION_STIMULUS_SECONDARY_SHARE) return "secondary";
  return "light";
}
