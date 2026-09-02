import type { TrainingPlanData } from "./training-plan.schema";

/**
 * AI may only create plans from the exercise catalog that the application can
 * actually explain, demonstrate, and log. This runs after Zod normalizes AI
 * output and before a plan becomes persisted user data.
 */
export function validateGeneratedTrainingPlan(
  plan: TrainingPlanData,
  expectedDays: number,
  catalogSlugs: Iterable<string>,
): TrainingPlanData {
  const expectedDayNumbers = Array.from({ length: expectedDays }, (_, index) => index + 1);
  const receivedDayNumbers = plan.days.map((day) => day.day).sort((a, b) => a - b);

  if (
    receivedDayNumbers.length !== expectedDayNumbers.length ||
    receivedDayNumbers.some((day, index) => day !== expectedDayNumbers[index])
  ) {
    throw new Error("Generated training plan does not contain the requested workout days.");
  }

  const knownSlugs = new Set(catalogSlugs);
  const unavailableSlugs = [
    ...new Set(
      plan.days.flatMap((day) =>
        day.exercises.map((exercise) => exercise.slug).filter((slug) => !knownSlugs.has(slug)),
      ),
    ),
  ];

  if (unavailableSlugs.length > 0) {
    throw new Error("Generated training plan contains exercises outside the available catalog.");
  }

  return plan;
}
