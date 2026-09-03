import { describe, expect, it } from "vitest";
import type { TrainingPlanDay } from "./training-plan.schema";
import { validateWorkoutSetAgainstPlan } from "./workout-set.engine";

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
    ).toEqual(day.exercises[0]);
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

  it("rejects mismatched exercise labels and set numbers beyond the adjusted plan", () => {
    expect(() =>
      validateWorkoutSetAgainstPlan(day, {
        exerciseSlug: "squat",
        exerciseName: "Barbell Squat",
        setNumber: 1,
      }),
    ).toThrow("name does not match");
    expect(() =>
      validateWorkoutSetAgainstPlan(day, {
        exerciseSlug: "squat",
        exerciseName: "Squat",
        setNumber: 3,
      }),
    ).toThrow("exceeds the planned 2 sets");
  });
});
