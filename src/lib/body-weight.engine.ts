/**
 * Which body weight an analysis should reason from.
 *
 * Three exist, and they are not equally good. `profiles.weight_kg` is what the
 * athlete stated once, during onboarding. `body_metrics.weight_kg` is what has
 * been recorded since — but that column holds two different things: a scale
 * reading the athlete typed in, and the photo scan's number, which is a vision
 * model's own guess whenever the athlete did not supply one.
 *
 * The order is: a scale reading, then a photo estimate, then the stated
 * weight, and the most recent within each kind. A guess from a photograph
 * taken today is worse evidence than a weighing from three days ago, and
 * anything that sizes meals, hydration or micronutrients from body mass is
 * entitled to know which it got. This used to call all three of them
 * "measured" — the same number, with the same authority, whatever produced
 * it.
 *
 * `hydration.service` resolved it inline; the meal plan and the micronutrient
 * scan hold this rule too, so it lives here rather than in three places.
 */

export type BodyWeightSource = "measured" | "photo_estimate" | "stated";

export type ResolvedBodyWeight = {
  weightKg: number | null;
  /** Null exactly when `weightKg` is null: nothing to attribute. */
  source: BodyWeightSource | null;
};

export type BodyWeightMeasurement = {
  /** Newest first; rows without a weight are skipped, not treated as zero. */
  weight_kg: number | string | null;
  /** Absent on rows written before provenance was recorded. */
  weight_source?: string | null;
};

function positive(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function resolveBodyWeight(
  measurements: readonly BodyWeightMeasurement[],
  statedKg: number | string | null | undefined,
): ResolvedBodyWeight {
  let estimated: number | null = null;

  for (const row of measurements) {
    const value = positive(row.weight_kg);
    if (value === null) continue;
    // A row whose provenance was never recorded is treated as a scale
    // reading: every row predates the photo scan writing its own provenance,
    // and the manual panel is the older and far more common path. Downgrading
    // them all to "estimate" would put a warning on numbers people did weigh.
    if (row.weight_source === "photo_estimate") {
      estimated ??= value;
      continue;
    }
    return { weightKg: value, source: "measured" };
  }

  if (estimated !== null) return { weightKg: estimated, source: "photo_estimate" };

  const stated = positive(statedKg);
  if (stated !== null) return { weightKg: stated, source: "stated" };

  // No weight anywhere. The caller says so rather than inventing one.
  return { weightKg: null, source: null };
}
