import type { TrainingPlanDay, TrainingPlanExercise } from "./training-plan.schema";

export type PlannedWorkoutSet = {
  exerciseSlug: string;
  exerciseName: string;
  setNumber: number;
};

export type ValidatedWorkoutSet = {
  exercise: TrainingPlanExercise;
  /** True when the athlete worked past what the day prescribed. */
  beyondPlan: boolean;
};

/**
 * The most sets one exercise can carry in a single session.
 *
 * This is an abuse bound, not a training opinion: no real session puts fifty
 * working sets into one movement, and an unbounded set number would let a
 * crafted request write arbitrarily many rows.
 */
export const MAX_SETS_PER_EXERCISE = 50;

/**
 * A set can be written only when it belongs to the day currently being
 * performed. The day passed here already includes its persisted readiness
 * adjustment, keeping client input from bypassing recovery safeguards.
 *
 * A set past the planned count is recorded rather than refused. The plan is a
 * recommendation; the set is something that already happened. Refusing it does
 * not un-train the muscle, it only hides the work from the Twin — which would
 * then model a body that did less than the real one, and advise on that
 * fiction. The safeguard belongs on what we recommend next, not on what we are
 * willing to write down.
 */
export function validateWorkoutSetAgainstPlan(
  plannedDay: TrainingPlanDay,
  input: PlannedWorkoutSet,
): ValidatedWorkoutSet {
  const exercise = plannedDay.exercises.find((item) => item.slug === input.exerciseSlug);
  if (!exercise) {
    throw new Error("Exercise does not belong to this workout.");
  }
  if (exercise.name !== input.exerciseName) {
    throw new Error("Exercise name does not match the workout plan.");
  }
  if (input.setNumber > MAX_SETS_PER_EXERCISE) {
    throw new Error(
      "Set number exceeds the " + MAX_SETS_PER_EXERCISE + " sets one exercise can hold.",
    );
  }
  return { exercise, beyondPlan: input.setNumber > exercise.sets };
}
