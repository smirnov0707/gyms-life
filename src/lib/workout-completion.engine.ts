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
  /** Completed logs for an exercise the day never prescribed. These block. */
  unexpectedCompletedSetKeys: string[];
  /** Completed sets past an exercise's planned count. Real work; never blocks. */
  extraSetKeys: string[];
  totalVolume: number;
};

const setKey = (exerciseSlug: string, setNumber: number) => `${exerciseSlug}:${setNumber}`;

/**
 * Evaluates a persisted workout attempt against the exact, readiness-adjusted
 * plan. It intentionally accepts only a narrow set-log shape so transport and
 * database details cannot affect completion decisions.
 *
 * Two different things used to be judged the same way. A set past an
 * exercise's planned count is the athlete doing more than was asked, and it
 * must not stop them finishing the session — blocking it would leave the
 * workout permanently unfinishable once such a set exists. A log for an
 * exercise the day never prescribed is a different matter: nothing in the
 * session should have written it, so it still blocks.
 */
export function evaluateWorkoutCompletion(
  plannedDay: TrainingPlanDay,
  logs: readonly WorkoutCompletionLog[],
): WorkoutCompletionEvaluation {
  const plannedSetsBySlug = new Map(
    plannedDay.exercises.map((exercise) => [exercise.slug, exercise.sets]),
  );
  const expectedSetKeys = plannedDay.exercises.flatMap((exercise) =>
    Array.from({ length: exercise.sets }, (_, index) => setKey(exercise.slug, index + 1)),
  );
  const completedLogs = logs.filter((log) => log.done);
  const completedSetKeys = new Set(
    completedLogs.map((log) => setKey(log.exercise_slug, log.set_number)),
  );
  const missingSetKeys = expectedSetKeys.filter((key) => !completedSetKeys.has(key));

  const unexpectedCompletedSetKeys: string[] = [];
  const extraSetKeys: string[] = [];
  const seen = new Set<string>();
  for (const log of completedLogs) {
    const key = setKey(log.exercise_slug, log.set_number);
    if (seen.has(key)) continue;
    seen.add(key);
    const plannedSets = plannedSetsBySlug.get(log.exercise_slug);
    if (plannedSets === undefined) unexpectedCompletedSetKeys.push(key);
    else if (log.set_number > plannedSets) extraSetKeys.push(key);
  }

  // Volume is what the session moved, so it counts every completed set of a
  // prescribed exercise — the ones past the plan included. Leaving them out
  // would report a lighter session than the body actually performed.
  const totalVolume = completedLogs
    .filter((log) => plannedSetsBySlug.has(log.exercise_slug))
    .reduce((sum, log) => sum + Math.max(0, log.reps ?? 0) * Math.max(0, log.weight_kg ?? 0), 0);

  return {
    canFinish: missingSetKeys.length === 0 && unexpectedCompletedSetKeys.length === 0,
    expectedSetCount: expectedSetKeys.length,
    completedSetCount: expectedSetKeys.length - missingSetKeys.length,
    missingSetKeys,
    unexpectedCompletedSetKeys,
    extraSetKeys,
    totalVolume: Math.round(totalVolume * 100) / 100,
  };
}
