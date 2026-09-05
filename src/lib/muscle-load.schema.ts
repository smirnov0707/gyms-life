import { z } from "zod";

/**
 * The muscle groups an exercise can belong to. Backed by the
 * `exercises_muscle_group_known` check constraint, so a value outside this
 * list now fails at write time rather than silently vanishing from the body
 * map — change one without the other and they drift apart.
 *
 * The engine still never rejects or drops an unlisted group. The constraint
 * stops bad data arriving; it is not a reason for the Twin to break if it
 * ever does.
 */
export const KNOWN_MUSCLE_GROUPS = [
  "legs",
  "back",
  "arms",
  "chest",
  "shoulders",
  "fullbody",
  "cardio",
  "core",
  "glutes",
  "abs",
  "mobility",
] as const;

/** A completed set, as selected from `set_logs`. */
export const MuscleLoadSetSourceSchema = z
  .object({
    exercise_slug: z.string().min(1),
    reps: z.number().finite().nullable(),
    weight_kg: z.number().finite().nullable(),
    done: z.boolean().nullable(),
    /** When the set was performed, not when its row was written. */
    performed_at: z.string().min(1),
  })
  .strict();

export type MuscleLoadSetSource = z.infer<typeof MuscleLoadSetSourceSchema>;

/** The muscle-group lookup, as selected from `exercises`. */
export const MuscleLoadExerciseSourceSchema = z
  .object({
    slug: z.string().min(1),
    muscle_group: z.string().min(1),
  })
  .strict();

export type MuscleLoadExerciseSource = z.infer<typeof MuscleLoadExerciseSourceSchema>;

/**
 * A deterministic, calculated estimate of recent training load and recovery
 * for one muscle group. `recoveryPct` is a fatigue-decay estimate, not a
 * physiological measurement — never label it as measured.
 */
export const MuscleGroupLoadSchema = z
  .object({
    muscleGroup: z.string().min(1),
    volumeKg: z.number().int().nonnegative(),
    recoveryPct: z.number().int().min(0).max(100),
    lastTrainedHoursAgo: z.number().int().nonnegative().nullable(),
  })
  .strict();

export type MuscleGroupLoad = z.infer<typeof MuscleGroupLoadSchema>;

/**
 * Shared recovery-band thresholds on `recoveryPct`. One definition for every
 * surface that colours recovery (Twin page, Today card, mapper), so "what
 * counts as recovered" cannot silently drift between them.
 */
export const MUSCLE_RECOVERY_FRESH_THRESHOLD = 80;
export const MUSCLE_RECOVERY_MODERATE_THRESHOLD = 55;
