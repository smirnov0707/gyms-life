import { ObservedFailure } from "./observability.server";
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
  sessionMinutes?: number,
): TrainingPlanData {
  const expectedDayNumbers = Array.from({ length: expectedDays }, (_, index) => index + 1);
  const receivedDayNumbers = plan.days.map((day) => day.day).sort((a, b) => a - b);

  if (
    receivedDayNumbers.length !== expectedDayNumbers.length ||
    receivedDayNumbers.some((day, index) => day !== expectedDayNumbers[index])
  ) {
    throw new ObservedFailure(
      "missing_days",
      "Generated training plan does not contain the requested workout days.",
    );
  }

  for (const day of plan.days) {
    if (sessionMinutes !== undefined) {
      const minimumRestSeconds = day.exercises.reduce(
        (total, exercise) => total + Math.max(0, exercise.sets - 1) * exercise.rest_seconds,
        0,
      );
      if (day.estimated_minutes > sessionMinutes || minimumRestSeconds >= sessionMinutes * 60)
        throw new ObservedFailure(
          "session_duration",
          "Generated workout does not fit the requested session duration.",
        );
    }
    if (day.exercises.length < 4 || day.exercises.length > 6) {
      throw new ObservedFailure(
        "exercise_count",
        "Generated training plan must contain 4–6 exercises per workout day.",
      );
    }
    if (new Set(day.exercises.map((exercise) => exercise.slug)).size !== day.exercises.length) {
      throw new ObservedFailure(
        "duplicate_exercise",
        "Generated training plan repeats an exercise within a workout day.",
      );
    }
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
    throw new ObservedFailure(
      "outside_catalog",
      "Generated training plan contains exercises outside the available catalog.",
    );
  }

  return plan;
}
