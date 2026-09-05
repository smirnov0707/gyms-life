/**
 * What a set's inputs should start with, so that recording the set a person
 * actually planned costs one tap instead of two keyboard entries.
 *
 * The rule throughout: pre-fill only values the plan or the person has
 * already stated. Never invent a number they might log without looking.
 */

/**
 * The reps to pre-fill for a planned set.
 *
 * A plan may specify reps as a single number ("8") or as a range ("8-12",
 * "8–12", "AMRAP"). Only an unambiguous single number is pre-filled: one end
 * of a range is a number the plan never actually asked for, and pre-filling
 * it invites logging a rep count nobody performed. Ranges keep an empty
 * field and the range itself as the placeholder.
 */
export function plannedRepsPrefill(plannedReps: string | number): string {
  const raw = String(plannedReps).trim();
  if (!/^\d+$/.test(raw)) return "";
  const reps = Number(raw);
  if (!Number.isInteger(reps) || reps < 1 || reps > 100) return "";
  return String(reps);
}

/**
 * The weight to pre-fill. Only a coach-suggested load counts: it is derived
 * from the person's own logged history, so it is a value the system already
 * stands behind. With no suggestion the field stays empty — guessing a
 * weight is guessing what someone lifted.
 */
export function suggestedWeightPrefill(suggestedWeightKg: number | null | undefined): string {
  if (suggestedWeightKg === null || suggestedWeightKg === undefined) return "";
  if (!Number.isFinite(suggestedWeightKg) || suggestedWeightKg < 0) return "";
  return String(suggestedWeightKg);
}

/** Reps move one at a time; load moves in the smallest plate jump. */
export const REPS_STEP = 1;
export const WEIGHT_STEP_KG = 2.5;

/**
 * Nudges a numeric field by a step, clamped, without needing the keyboard.
 * An empty field starts from `fallback` so the first tap is still useful.
 */
export function stepValue(
  current: string,
  step: number,
  { min, max, fallback }: { min: number; max: number; fallback: number },
): string {
  const parsed = Number(current);
  const base = current.trim() === "" || !Number.isFinite(parsed) ? fallback : parsed;
  const next = Math.min(max, Math.max(min, base + step));
  // Avoid 62.50000000000001 from repeated 2.5 kg additions.
  return String(Math.round(next * 100) / 100);
}
