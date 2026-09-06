/**
 * How well a restaurant dish suits the athlete's goal, computed from its own
 * macros.
 *
 * The menu scanner used to print a "95% FIT" badge. Nothing computed that
 * number: the model was asked for a `fitScore` the prompt never defined, and
 * the prompt's own example showed 95, so it was anchored high and asserted.
 *
 * This replaces it with arithmetic over the macros already on screen. The
 * result is a band rather than a percentage, because the inputs are the
 * model's estimate of a menu item and a percentage would put false precision
 * on top of that. The measured basis is returned alongside so the screen can
 * show what the band was decided from.
 */

export const PROTEIN_KCAL_PER_G = 4;
export const FAT_KCAL_PER_G = 9;

/**
 * Grams of protein per 100 kcal. The useful axis for every goal here: it
 * separates a grilled chicken plate (about 8) from a burger (about 5), a
 * pizza slice (about 4) and fries (about 1), independently of portion size.
 */
export const PROTEIN_DENSE_FROM = 7;
export const PROTEIN_MODERATE_FROM = 4.5;

/** A main meal's worth of energy, used only to judge whether a dish is large. */
export const REFERENCE_MEAL_KCAL = 700;
export const LARGE_MEAL_KCAL = 910;

/** Above this share of energy from fat, a dish stops being a balanced choice. */
export const FAT_SHARE_BALANCED_TO = 35;
export const FAT_SHARE_WORKABLE_TO = 45;

export type DishGoal = "muscle_gain" | "fat_loss" | "healthy";
export type DishFitBand = "strong" | "workable" | "poor";

export type DishMacros = {
  calories: number;
  protein: number;
  fat: number;
};

export type DishFit = {
  /** Null when the dish reports no usable energy, so nothing was decided. */
  band: DishFitBand | null;
  /** The figures the band was decided from. Null when they cannot be formed. */
  proteinPer100Kcal: number | null;
  fatSharePct: number | null;
};

const round1 = (value: number) => Math.round(value * 10) / 10;

export function calculateDishFit(macros: DishMacros, goal: DishGoal): DishFit {
  const { calories, protein, fat } = macros;

  // A dish with no stated energy cannot be judged against anything. Returning
  // a band anyway would be a verdict with nothing behind it.
  if (!Number.isFinite(calories) || calories <= 0) {
    return { band: null, proteinPer100Kcal: null, fatSharePct: null };
  }

  const proteinPer100Kcal = round1((protein * 100) / calories);
  const fatSharePct = round1(((fat * FAT_KCAL_PER_G) / calories) * 100);

  const band = ((): DishFitBand => {
    if (goal === "muscle_gain") {
      if (proteinPer100Kcal >= PROTEIN_DENSE_FROM) return "strong";
      if (proteinPer100Kcal >= PROTEIN_MODERATE_FROM) return "workable";
      return "poor";
    }

    if (goal === "fat_loss") {
      // Density and size both matter here: a protein-dense dish that carries
      // a day's energy is still the wrong order.
      if (proteinPer100Kcal >= PROTEIN_DENSE_FROM && calories <= REFERENCE_MEAL_KCAL) {
        return "strong";
      }
      if (proteinPer100Kcal >= PROTEIN_MODERATE_FROM && calories <= LARGE_MEAL_KCAL) {
        return "workable";
      }
      return "poor";
    }

    // "healthy" is about balance rather than maximising one macro.
    if (fatSharePct <= FAT_SHARE_BALANCED_TO && proteinPer100Kcal >= PROTEIN_MODERATE_FROM) {
      return "strong";
    }
    if (fatSharePct <= FAT_SHARE_WORKABLE_TO) return "workable";
    return "poor";
  })();

  return { band, proteinPer100Kcal, fatSharePct };
}
