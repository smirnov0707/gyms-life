import { state, count, persist, delay, ids } from "./state";
import type { WorkoutSetSync } from "../../src/lib/offline-store";
const SESSION = "55555555-5555-4555-8555-555555555555";
const workout = () => ({
  ...state.plan.days[0]!,
  exercises: state.plan.days[0]!.exercises.slice(0, 2),
});
const adaptation = {
  version: "1.0" as const,
  readinessModifier: 1,
  reasons: [],
  sourceContextIds: [],
  timeBudgetMinutes: null,
  substitutions: [],
  omittedExerciseSlugs: [],
};
export async function getTodaysWorkout() {
  count("getTodaysWorkout");
  if (state.fail === "workoutRead") throw new Error("Synthetic next-workout source outage");
  return { status: "READY", workout: workout() };
}
export async function startWorkout() {
  count("startWorkout");
  await delay();
  const resumed = state.workoutSession.started;
  state.workoutSession.started = true;
  persist();
  return {
    session: { id: SESSION, planId: ids.TRAINING_ID },
    workout: workout(),
    adaptation,
    guidance: { exercises: [] },
    resumed,
    logs: state.workoutSession.logs,
  };
}
export async function logWorkoutSet({ data }: { data: WorkoutSetSync }) {
  count("logWorkoutSet");
  await delay();
  if (state.fail === "setNetwork") throw new TypeError("Failed to fetch (synthetic)");
  if (data.sessionId !== SESSION || !state.workoutSession.started || state.workoutSession.finished)
    throw new Error("Invalid synthetic session");
  const existing = state.workoutSession.logs.find(
    (log) => log.exercise_slug === data.exerciseSlug && log.set_number === data.setNumber,
  );
  if (existing) return { ok: true, setLog: existing, alreadyLogged: true };
  const row = {
    exercise_slug: data.exerciseSlug,
    set_number: data.setNumber,
    done: data.done,
    weight_kg: data.weightKg,
    reps: data.reps,
  };
  state.workoutSession.logs.push(row);
  persist();
  return { ok: true, setLog: row, alreadyLogged: false };
}
export async function finishWorkout() {
  count("finishWorkout");
  await delay();
  if (
    workout().exercises.some((exercise) =>
      Array.from({ length: exercise.sets }, (_, index) => index + 1).some(
        (number) =>
          !state.workoutSession.logs.some(
            (log) => log.exercise_slug === exercise.slug && log.set_number === number && log.done,
          ),
      ),
    )
  )
    throw new Error("Missing synthetic completed sets");
  state.workoutSession.finished = true;
  persist();
  const volume = state.workoutSession.logs.reduce(
    (total, log) => total + (log.weight_kg ?? 0) * (log.reps ?? 0),
    0,
  );
  return {
    session: { id: SESSION, durationSeconds: 600, totalVolume: volume },
    muscleBreakdown: [],
    replayStatus: "unavailable",
  };
}
export async function recordWorkoutReflection({ data }: { data: { feeling: number } }) {
  count("recordWorkoutReflection");
  return { feeling: data.feeling };
}
