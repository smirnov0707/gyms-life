import { describe, expect, it } from "vitest";
import type { TrainingPlanDay } from "./training-plan.schema";
import { resolveWorkoutSessionDay } from "./workout-session-plan.engine";
import type { WorkoutSession } from "./workout-session.schema";

const baseDay: TrainingPlanDay = {
  day: 1,
  title: "Upper",
  focus: "Pressing",
  warmup: "Walk",
  cooldown: "Stretch",
  estimated_minutes: 45,
  exercises: [
    {
      slug: "bench-press",
      name: "Bench press",
      sets: 3,
      reps: "8",
      rest_seconds: 120,
      notes: "",
    },
  ],
};

function executionSource(
  overrides: Partial<
    Pick<WorkoutSession, "dayIndex" | "adaptationModifier" | "workoutSnapshot">
  > = {},
): Pick<WorkoutSession, "dayIndex" | "adaptationModifier" | "workoutSnapshot"> {
  return {
    dayIndex: 0,
    adaptationModifier: 1,
    workoutSnapshot: null,
    ...overrides,
  };
}

describe("workout session plan engine", () => {
  it("always keeps an in-progress session on its immutable execution snapshot", () => {
    const snapshotDay: TrainingPlanDay = {
      ...baseDay,
      title: "Upper — adapted",
      exercises: [{ ...baseDay.exercises[0], sets: 2 }],
    };

    const result = resolveWorkoutSessionDay(
      executionSource({
        workoutSnapshot: {
          version: "1.0",
          workout: snapshotDay,
          adaptation: {
            version: "1.0",
            readinessModifier: 0.8,
            reasons: ["readiness"],
            sourceContextIds: [],
            timeBudgetMinutes: null,
            substitutions: [],
            omittedExerciseSlugs: [],
          },
        },
      }),
      baseDay,
    );

    expect(result).toEqual(snapshotDay);
  });

  it("uses the validated legacy plan day with its stored adaptation only when no snapshot exists", () => {
    const result = resolveWorkoutSessionDay(executionSource({ adaptationModifier: 0.7 }), baseDay);

    expect(result?.exercises[0]?.sets).toBe(2);
  });

  it("rejects a corrupt snapshot that does not belong to the session day", () => {
    const result = resolveWorkoutSessionDay(
      executionSource({
        workoutSnapshot: {
          version: "1.0",
          workout: { ...baseDay, day: 2 },
          adaptation: {
            version: "1.0",
            readinessModifier: 1,
            reasons: [],
            sourceContextIds: [],
            timeBudgetMinutes: null,
            substitutions: [],
            omittedExerciseSlugs: [],
          },
        },
      }),
      baseDay,
    );

    expect(result).toBeNull();
  });
});
