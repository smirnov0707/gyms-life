import type { TrainingPlanDay } from "./training-plan.schema";
import type { OfflinePayload } from "./offline-store";
import { nextSetNumber } from "./workout-set-prefill";
type LoggedSet = { exercise_slug: string; set_number: number; done: boolean };
/** Call after the server confirms the session: only its queued records count. */
export function restoreWorkoutProgress(
  workout: TrainingPlanDay,
  sessionId: string,
  logs: readonly LoggedSet[],
  queued: readonly OfflinePayload[],
) {
  const numbers = (slug: string) => completedWorkoutSetNumbers(sessionId, slug, logs, queued);
  const firstMissing = workout.exercises.findIndex(
    (exercise) => nextSetNumber(exercise.sets, numbers(exercise.slug)) <= exercise.sets,
  );
  const exerciseIndex = firstMissing < 0 ? Math.max(0, workout.exercises.length - 1) : firstMissing;
  const exercise = workout.exercises[exerciseIndex];
  if (!exercise) throw new Error("The saved workout has no exercises.");
  return { exerciseIndex, setNumber: nextSetNumber(exercise.sets, numbers(exercise.slug)) };
}

export function completedWorkoutSetNumbers(
  sessionId: string,
  slug: string,
  logs: readonly LoggedSet[],
  queued: readonly OfflinePayload[],
): Set<number> {
  return new Set([
    ...logs.filter((log) => log.done && log.exercise_slug === slug).map((log) => log.set_number),
    ...queued
      .filter(
        (item) =>
          item.data.sessionId === sessionId && item.data.exerciseSlug === slug && item.data.done,
      )
      .map((item) => item.data.setNumber),
  ]);
}
