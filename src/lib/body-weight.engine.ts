/**
 * Which body weight an analysis should reason from.
 *
 * Two exist. `profiles.weight_kg` is what the athlete stated once, during
 * onboarding; `body_metrics.weight_kg` is what they have weighed since, from
 * the scale panel or a body scan. Anything that computes a target from body
 * mass has to prefer the measurement, or it keeps sizing meals and
 * micronutrients for the body someone had on the day they signed up.
 *
 * `hydration.service` already resolved it this way inline. This is that rule,
 * on its own, so the meal plan and the micronutrient scan can hold it too.
 */

export type BodyWeightSource = "measured" | "stated";

export type ResolvedBodyWeight = {
  weightKg: number | null;
  /** Null exactly when `weightKg` is null: nothing to attribute. */
  source: BodyWeightSource | null;
};

export type BodyWeightMeasurement = {
  /** Newest first; rows without a weight are skipped, not treated as zero. */
  weight_kg: number | string | null;
};

export function resolveBodyWeight(
  measurements: readonly BodyWeightMeasurement[],
  statedKg: number | string | null | undefined,
): ResolvedBodyWeight {
  const measured = measurements.find((row) => row.weight_kg != null)?.weight_kg;
  if (measured != null) {
    const value = Number(measured);
    if (Number.isFinite(value) && value > 0) return { weightKg: value, source: "measured" };
  }

  if (statedKg != null) {
    const value = Number(statedKg);
    if (Number.isFinite(value) && value > 0) return { weightKg: value, source: "stated" };
  }

  // No weight anywhere. The caller says so rather than inventing one.
  return { weightKg: null, source: null };
}
