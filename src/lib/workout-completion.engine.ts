import type { TrainingPlanDay } from "./training-plan.schema";

export type WorkoutCompletionLog = {
  exercise_slug: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  done: boolean;
};

export type WorkoutCompletionEvaluation = {
  canFinish: boolean;
  expectedSetCount: number;
  completedSetCount: number;
  missingSetKeys: string[];
  unexpectedCompletedSetKeys: string[];
  totalVolume: number;
};

const setKey = (exerciseSlug: string, setNumber: number) => `${exerciseSlug}:${setNumber}`;

/**
 * Evaluates a persisted workout attempt against the exact, readiness-adjusted
 * plan. It intentionally accepts only a narrow set-log shape so transport and
 * database details cannot affect completion decisions.
 */
export function evaluateWorkoutCompletion(
  plannedDay: TrainingPlanDay,
  logs: readonly WorkoutCompletionLog[],
): WorkoutCompletionEvaluation {
  const expectedSetKeys = plannedDay.exercises.flatMap((exercise) =>
    Array.from({ length: exercise.sets }, (_, index) => setKey(exercise.slug, index + 1)),
  );
  const expectedSetKeySet = new Set(expectedSetKeys);
  const completedLogs = logs.filter((log) => log.done);
  const completedSetKeys = new Set(
    completedLogs.map((log) => setKey(log.exercise_slug, log.set_number)),
  );
  const missingSetKeys = expectedSetKeys.filter((key) => !completedSetKeys.has(key));
  const unexpectedCompletedSetKeys = [...completedSetKeys].filter(
    (key) => !expectedSetKeySet.has(key),
  );
  const plannedCompletedLogs = completedLogs.filter((log) =>
    expectedSetKeySet.has(setKey(log.exercise_slug, log.set_number)),
  );
  const totalVolume = plannedCompletedLogs.reduce(
    (sum, log) => sum + Math.max(0, log.reps ?? 0) * Math.max(0, log.weight_kg ?? 0),
    0,
  );

  return {
    canFinish: missingSetKeys.length === 0 && unexpectedCompletedSetKeys.length === 0,
    expectedSetCount: expectedSetKeys.length,
    completedSetCount: expectedSetKeys.length - missingSetKeys.length,
    missingSetKeys,
    unexpectedCompletedSetKeys,
    totalVolume: Math.round(totalVolume * 100) / 100,
  };
}
