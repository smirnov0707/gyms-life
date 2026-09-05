import { describe, expect, it } from "vitest";
import type { TrainingPlanDay } from "./training-plan.schema";
import { MAX_SETS_PER_EXERCISE, validateWorkoutSetAgainstPlan } from "./workout-set.engine";

const day: TrainingPlanDay = {
  day: 1,
  title: "Strength",
  focus: "Full body",
  warmup: "Walk",
  cooldown: "Stretch",
  estimated_minutes: 45,
  exercises: [{ slug: "squat", name: "Squat", sets: 2, reps: "8", rest_seconds: 90, notes: "" }],
};

describe("workout set engine", () => {
  it("accepts a set from the exact readiness-adjusted workout", () => {
    expect(
      validateWorkoutSetAgainstPlan(day, {
        exerciseSlug: "squat",
        exerciseName: "Squat",
        setNumber: 2,
      }),
    ).toEqual({ exercise: day.exercises[0], beyondPlan: false });
  });

  it("rejects an exercise that is not prescribed for the current day", () => {
    expect(() =>
      validateWorkoutSetAgainstPlan(day, {
        exerciseSlug: "curl",
        exerciseName: "Curl",
        setNumber: 1,
      }),
    ).toThrow("does not belong");
  });

  it("rejects a mismatched exercise label", () => {
    expect(() =>
      validateWorkoutSetAgainstPlan(day, {
        exerciseSlug: "squat",
        exerciseName: "Barbell Squat",
        setNumber: 1,
      }),
    ).toThrow("name does not match");
  });

  it("records a set past the plan instead of refusing it", () => {
    // Refusing this set does not un-train the muscle. It only hides real work
    // from the Twin, which would then model a body that did less than it did.
    expect(
      validateWorkoutSetAgainstPlan(day, {
        exerciseSlug: "squat",
        exerciseName: "Squat",
        setNumber: 3,
      }),
    ).toEqual({ exercise: day.exercises[0], beyondPlan: true });
  });

  it("still bounds how many sets one exercise can hold", () => {
    expect(
      validateWorkoutSetAgainstPlan(day, {
        exerciseSlug: "squat",
        exerciseName: "Squat",
        setNumber: MAX_SETS_PER_EXERCISE,
      }).beyondPlan,
    ).toBe(true);
    expect(() =>
      validateWorkoutSetAgainstPlan(day, {
        exerciseSlug: "squat",
        exerciseName: "Squat",
        setNumber: MAX_SETS_PER_EXERCISE + 1,
      }),
    ).toThrow("50 sets");
  });
});
