import type { TrainingPlanDay, TrainingPlanExercise } from "./training-plan.schema";

export type PlannedWorkoutSet = {
  exerciseSlug: string;
  exerciseName: string;
  setNumber: number;
};

/**
 * A set can be written only when it belongs to the exact day currently being
 * performed. The day passed here already includes its persisted readiness
 * adjustment, keeping client input from bypassing recovery safeguards.
 */
export function validateWorkoutSetAgainstPlan(
  plannedDay: TrainingPlanDay,
  input: PlannedWorkoutSet,
): TrainingPlanExercise {
  const exercise = plannedDay.exercises.find((item) => item.slug === input.exerciseSlug);
  if (!exercise) {
    throw new Error("Exercise does not belong to this workout.");
  }
  if (exercise.name !== input.exerciseName) {
    throw new Error("Exercise name does not match the workout plan.");
  }
  if (input.setNumber > exercise.sets) {
    throw new Error("Set number exceeds the planned " + exercise.sets + " sets.");
  }
  return exercise;
}
