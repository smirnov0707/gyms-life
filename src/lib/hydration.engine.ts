import {
  HydrationInputSchema,
  HydrationTargetSchema,
  type HydrationComponent,
  type HydrationInput,
  type HydrationMissingInput,
  type HydrationTarget,
} from "./hydration.schema";

/**
 * Daily fluid target from logged evidence.
 *
 * Every coefficient below is a published maintenance heuristic, kept small in
 * number and visible in the output. The point is not that these constants are
 * the last word on hydration — it is that the athlete can see the whole sum
 * and judge it, rather than being handed a number with no derivation.
 *
 * Change any of these deliberately: they are user-visible.
 */

/** Baseline maintenance per kilogram of total body mass. */
export const HYDRATION_ML_PER_KG = 33;

/**
 * Baseline per kilogram of lean mass, used when body fat is known.
 *
 * Body water lives in lean tissue, so lean mass is the better predictor.
 * At an average composition (about 20% fat) this lands within one rounding
 * step of the total-mass rule, so the typical case barely moves. It changes
 * the answer for very lean and very heavy bodies — which is exactly where a
 * rule based on total mass is worst.
 */
export const HYDRATION_ML_PER_KG_LEAN = 41;

/** Sweat replacement per hour of logged training. */
export const HYDRATION_ML_PER_TRAINING_HOUR = 500;

/** Creatine raises intracellular water; this is the usual added allowance. */
export const HYDRATION_ML_CREATINE = 500;

/** Caffeinated pre-workout is a mild diuretic. */
export const HYDRATION_ML_STIMULANTS = 250;

/** Extra water to clear the nitrogen load of a genuinely high protein day. */
export const HYDRATION_ML_HIGH_PROTEIN = 250;
export const HYDRATION_HIGH_PROTEIN_G_PER_KG = 2;

/**
 * Used only when body weight is unknown. Labelled "generic" in the result so
 * it is never mistaken for the athlete's own figure.
 */
export const HYDRATION_GENERIC_BASELINE_ML = 2500;

/**
 * Drinking far beyond need is not harmless — hyponatremia is a real risk at
 * extremes — so the total is clamped and the UI is told it was.
 */
export const HYDRATION_MIN_ML = 1500;
export const HYDRATION_MAX_ML = 5000;

/** Above this, replacing electrolytes matters as much as the water itself. */
export const HYDRATION_ELECTROLYTE_THRESHOLD_ML = 4000;

const CREATINE_CATEGORIES = new Set(["creatine"]);
const STIMULANT_CATEGORIES = new Set(["preworkout"]);

function roundTo50(ml: number): number {
  return Math.round(ml / 50) * 50;
}

export function calculateHydrationTarget(input: HydrationInput): HydrationTarget {
  const parsed = HydrationInputSchema.parse(input);
  const components: HydrationComponent[] = [];
  const missingInputs: HydrationMissingInput[] = [];

  // Baseline. Without a body weight there is no personal number to give, so
  // the result says "generic" rather than dressing a default up as theirs.
  const personal = parsed.bodyWeightKg !== null;
  if (personal) {
    const weightKg = parsed.bodyWeightKg!;
    if (parsed.bodyFatPct !== null) {
      const leanKg = Math.round(weightKg * (1 - parsed.bodyFatPct / 100) * 10) / 10;
      components.push({
        key: "baseline",
        ml: Math.round(leanKg * HYDRATION_ML_PER_KG_LEAN),
        inputs: { leanKg, mlPerKg: HYDRATION_ML_PER_KG_LEAN, bodyFatPct: parsed.bodyFatPct },
      });
    } else {
      components.push({
        key: "baseline",
        ml: Math.round(weightKg * HYDRATION_ML_PER_KG),
        inputs: { weightKg, mlPerKg: HYDRATION_ML_PER_KG },
      });
    }
  } else {
    missingInputs.push("body_weight");
    components.push({
      key: "baseline",
      ml: HYDRATION_GENERIC_BASELINE_ML,
      inputs: {},
    });
  }

  if (parsed.trainingMinutesToday > 0) {
    const hours = parsed.trainingMinutesToday / 60;
    components.push({
      key: "training",
      ml: Math.round(hours * HYDRATION_ML_PER_TRAINING_HOUR),
      inputs: { minutes: Math.round(parsed.trainingMinutesToday) },
    });
  } else {
    missingInputs.push("training");
  }

  const categories = new Set(parsed.supplementCategories);
  if ([...categories].some((category) => CREATINE_CATEGORIES.has(category))) {
    components.push({ key: "creatine", ml: HYDRATION_ML_CREATINE, inputs: {} });
  }
  if ([...categories].some((category) => STIMULANT_CATEGORIES.has(category))) {
    components.push({ key: "stimulants", ml: HYDRATION_ML_STIMULANTS, inputs: {} });
  }

  // A protein allowance needs both the grams eaten and the body mass to judge
  // them against. With either missing we add nothing rather than guess.
  if (parsed.proteinGramsToday === null) {
    missingInputs.push("nutrition");
  } else if (personal) {
    const perKg = parsed.proteinGramsToday / parsed.bodyWeightKg!;
    if (perKg >= HYDRATION_HIGH_PROTEIN_G_PER_KG) {
      components.push({
        key: "protein",
        ml: HYDRATION_ML_HIGH_PROTEIN,
        inputs: {
          proteinG: Math.round(parsed.proteinGramsToday),
          perKg: Math.round(perKg * 10) / 10,
        },
      });
    }
  }

  const raw = components.reduce((sum, component) => sum + component.ml, 0);
  const rounded = roundTo50(raw);
  const targetMl = Math.min(HYDRATION_MAX_ML, Math.max(HYDRATION_MIN_ML, rounded));

  return HydrationTargetSchema.parse({
    basis: personal ? "personal" : "generic",
    targetMl,
    components,
    missingInputs,
    cappedFromMl: rounded > HYDRATION_MAX_ML ? rounded : null,
    electrolyteNote: targetMl >= HYDRATION_ELECTROLYTE_THRESHOLD_ML,
  });
}
