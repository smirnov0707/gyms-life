import { z } from "zod";

/**
 * Daily macro targets, and where they came from.
 *
 * There were two answers to "what is my calorie target": the nutrition
 * screen computed one from body weight, the coach read another from the
 * active meal plan. They could differ by hundreds of calories with nothing
 * to say which was right. The plan wins when there is one — it is the thing
 * the athlete actually agreed to — and an estimate is labelled as an
 * estimate.
 */

export const NutritionTargetsBasisSchema = z.enum(["meal_plan", "estimated", "unavailable"]);
export type NutritionTargetsBasis = z.infer<typeof NutritionTargetsBasisSchema>;

export const NutritionTargetsSchema = z
  .object({
    basis: NutritionTargetsBasisSchema,
    kcal: z.number().int().positive().nullable(),
    proteinG: z.number().int().nonnegative().nullable(),
    fatG: z.number().int().nonnegative().nullable(),
    carbsG: z.number().int().nonnegative().nullable(),
    /** Named so the UI can say what to add rather than showing a guess. */
    missing: z.array(z.enum(["body_weight", "meal_plan"])),
  })
  .strict();
export type NutritionTargets = z.infer<typeof NutritionTargetsSchema>;

/** Calories per kilogram of body weight, by training goal. */
export const KCAL_PER_KG_BY_GOAL: Record<string, number> = {
  lose: 28,
  muscle: 38,
  recomp: 34,
  strength: 36,
};
export const KCAL_PER_KG_DEFAULT = 34;
export const PROTEIN_G_PER_KG = 2;
export const FAT_G_PER_KG = 0.9;
export const MIN_CARBS_G = 50;

function round(value: number): number {
  return Math.round(value);
}

/**
 * Resolves the day's targets from the plan first, then from body weight.
 *
 * With neither, nothing is returned. The screen used to fall back to a
 * hardcoded 75 kg, which produced a confident, personal-looking target for
 * someone who had never told us anything about their body.
 */
export function resolveNutritionTargets(input: {
  planKcal: number | null;
  planProteinG: number | null;
  planFatG: number | null;
  planCarbsG: number | null;
  bodyWeightKg: number | null;
  goal: string | null;
}): NutritionTargets {
  if (input.planKcal !== null && input.planKcal > 0) {
    return NutritionTargetsSchema.parse({
      basis: "meal_plan",
      kcal: round(input.planKcal),
      proteinG: input.planProteinG === null ? null : round(input.planProteinG),
      fatG: input.planFatG === null ? null : round(input.planFatG),
      carbsG: input.planCarbsG === null ? null : round(input.planCarbsG),
      missing: [],
    });
  }

  if (input.bodyWeightKg === null || input.bodyWeightKg <= 0) {
    return NutritionTargetsSchema.parse({
      basis: "unavailable",
      kcal: null,
      proteinG: null,
      fatG: null,
      carbsG: null,
      missing: ["meal_plan", "body_weight"],
    });
  }

  const perKg = KCAL_PER_KG_BY_GOAL[input.goal ?? ""] ?? KCAL_PER_KG_DEFAULT;
  const kcal = round(input.bodyWeightKg * perKg);
  const proteinG = round(input.bodyWeightKg * PROTEIN_G_PER_KG);
  const fatG = round(input.bodyWeightKg * FAT_G_PER_KG);

  return NutritionTargetsSchema.parse({
    basis: "estimated",
    kcal,
    proteinG,
    fatG,
    // Whatever energy the other two do not account for, never below a floor
    // the body needs regardless.
    carbsG: Math.max(MIN_CARBS_G, round((kcal - proteinG * 4 - fatG * 9) / 4)),
    missing: ["meal_plan"],
  });
}
