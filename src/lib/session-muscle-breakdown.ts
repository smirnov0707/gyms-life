import { z } from "zod";
import {
  MuscleLoadExerciseSourceSchema,
  type MuscleLoadExerciseSource,
} from "./muscle-load.schema";

/** Recorded session quantities, not measured muscle activation or recovery. */
export const SessionSetSourceSchema = z
  .object({
    exercise_slug: z.string().min(1),
    reps: z.number().finite().nullable(),
    weight_kg: z.number().finite().nullable(),
    done: z.boolean().nullable(),
  })
  .strict();
export type SessionSetSource = z.infer<typeof SessionSetSourceSchema>;

/** An explicitly non-anatomical bucket; never distribute it across the body. */
export const UNASSIGNED_SESSION_REGION = "__unassigned__";

export const SessionMuscleContributionSchema = z
  .object({
    muscleGroup: z.string().min(1),
    /** Null means incomplete/unsupported; an explicitly logged zero stays zero. */
    volumeKg: z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable(),
    sets: z.number().int().positive(),
    /** No percentage of a session whose denominator is incomplete or unsafe. */
    shareOfSession: z.number().min(0).max(1).nullable(),
    /** Optional for compatibility with older in-memory responses. New results always set it. */
    mappingStatus: z.enum(["catalogue", "unassigned", "unavailable"]).optional(),
  })
  .strict();
export type SessionMuscleContribution = z.infer<typeof SessionMuscleContributionSchema>;

/**
 * Completed set counts remain visible even when their external-weight × reps
 * total cannot be stated. Incomplete groups never masquerade as partial totals.
 * Catalogue lookup failure is distinct from a successful lookup with no match.
 * This projection never changes raw logs, completion rules or persisted history.
 */
export function buildSessionMuscleBreakdown(
  sets: SessionSetSource[],
  exercises: MuscleLoadExerciseSource[],
  catalogueAvailable = true,
): SessionMuscleContribution[] {
  const parsedSets = z.array(SessionSetSourceSchema).parse(sets);
  const parsedExercises = z.array(MuscleLoadExerciseSourceSchema).parse(exercises);
  const groupBySlug = new Map<string, string | null>();
  if (catalogueAvailable) {
    for (const exercise of parsedExercises) {
      const previous = groupBySlug.get(exercise.slug);
      groupBySlug.set(
        exercise.slug,
        previous === undefined || previous === exercise.muscle_group ? exercise.muscle_group : null,
      );
    }
  }
  const byGroup = new Map<string, { volume: number; complete: boolean; sets: number }>();
  for (const set of parsedSets) {
    if (set.done !== true) continue;
    const group = groupBySlug.get(set.exercise_slug) ?? UNASSIGNED_SESSION_REGION;
    const entry = byGroup.get(group) ?? { volume: 0, complete: true, sets: 0 };
    entry.sets += 1;
    const supported =
      set.reps !== null &&
      Number.isSafeInteger(set.reps) &&
      set.reps > 0 &&
      set.weight_kg !== null &&
      set.weight_kg >= 0;
    const volume = supported ? set.reps! * set.weight_kg! : null;
    if (
      volume === null ||
      !Number.isFinite(volume) ||
      volume > Number.MAX_SAFE_INTEGER ||
      entry.volume + volume > Number.MAX_SAFE_INTEGER
    ) {
      entry.complete = false;
    } else {
      entry.volume += volume;
    }
    byGroup.set(group, entry);
  }
  const entries = [...byGroup.entries()];
  const totalVolume = entries.reduce((sum, [, entry]) => sum + entry.volume, 0);
  const totalIsKnown =
    entries.every(([, entry]) => entry.complete) &&
    Number.isFinite(totalVolume) &&
    totalVolume <= Number.MAX_SAFE_INTEGER;
  return entries
    .map(([muscleGroup, entry]) =>
      SessionMuscleContributionSchema.parse({
        muscleGroup,
        volumeKg: entry.complete ? Math.round(entry.volume) : null,
        sets: entry.sets,
        shareOfSession:
          totalIsKnown && totalVolume > 0
            ? Math.round((entry.volume / totalVolume) * 100) / 100
            : null,
        mappingStatus: !catalogueAvailable
          ? "unavailable"
          : muscleGroup === UNASSIGNED_SESSION_REGION
            ? "unassigned"
            : "catalogue",
      }),
    )
    .sort(
      (a, b) =>
        (b.volumeKg ?? -1) - (a.volumeKg ?? -1) ||
        b.sets - a.sets ||
        a.muscleGroup.localeCompare(b.muscleGroup),
    );
}

/** Legacy relative-volume labels, not physiological stimulus. Replay uses quantities instead. */
export const SESSION_STIMULUS_PRIMARY_SHARE = 0.3;
export const SESSION_STIMULUS_SECONDARY_SHARE = 0.1;
export type SessionStimulus = "primary" | "secondary" | "light" | "none";
export function stimulusFor(contribution: SessionMuscleContribution): SessionStimulus {
  if (contribution.shareOfSession === null) return "light";
  if (contribution.shareOfSession >= SESSION_STIMULUS_PRIMARY_SHARE) return "primary";
  if (contribution.shareOfSession >= SESSION_STIMULUS_SECONDARY_SHARE) return "secondary";
  return "light";
}
