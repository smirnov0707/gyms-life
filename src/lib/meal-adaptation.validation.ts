import type { GeneratedMealPlan, MealDay } from "./meal-plan.schema";
/** Enforces the advertised bound; a prompt is not a safety or consistency check. */
export function validateAdaptationTargets(
  current: GeneratedMealPlan,
  proposed: {
    kcal_target: number;
    protein_target: number;
    carbs_target: number;
    fat_target: number;
    days: MealDay[];
  },
): void {
  for (const key of ["kcal_target", "protein_target", "carbs_target", "fat_target"] as const) {
    const before = current[key],
      after = proposed[key];
    if (
      !Number.isFinite(after) ||
      after < 0 ||
      Math.abs(after - before) > Math.max(1, before * 0.15)
    )
      throw new Error(
        "Adapted targets exceed the permitted 15% change. Generate a new plan for a larger change.",
      );
  }
  for (const day of proposed.days) {
    const total = day.meals.reduce((sum, meal) => sum + meal.kcal, 0);
    if (Math.abs(total - proposed.kcal_target) > Math.max(10, proposed.kcal_target * 0.1))
      throw new Error("Adapted meals do not match their energy target.");
  }
}
