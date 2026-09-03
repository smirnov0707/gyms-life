import { describe, expect, it } from "vitest";
import type { TrainingPlanDay } from "./training-plan.schema";
import { evaluateWorkoutCompletion } from "./workout-completion.engine";

const day: TrainingPlanDay = {
  day: 1,
  title: "Strength",
  focus: "Full body",
  warmup: "Walk",
  cooldown: "Stretch",
  estimated_minutes: 45,
  exercises: [
    { slug: "squat", name: "Squat", sets: 2, reps: "8", rest_seconds: 90, notes: "" },
    { slug: "row", name: "Row", sets: 2, reps: "10", rest_seconds: 90, notes: "" },
  ],
};

const set = (
  exerciseSlug: string,
  setNumber: number,
  reps: number | null,
  weightKg: number | null,
  done = true,
) => ({
  exercise_slug: exerciseSlug,
  set_number: setNumber,
  reps,
  weight_kg: weightKg,
  done,
});

describe("workout completion engine", () => {
  it("finishes only an exact, completed plan and totals its planned volume", () => {
    const result = evaluateWorkoutCompletion(day, [
      set("squat", 1, 8, 100),
      set("squat", 2, 8, 100),
      set("row", 1, 10, 50),
      set("row", 2, 10, 50),
    ]);

    expect(result).toMatchObject({
      canFinish: true,
      expectedSetCount: 4,
      completedSetCount: 4,
      missingSetKeys: [],
      unexpectedCompletedSetKeys: [],
      totalVolume: 2600,
    });
  });

  it("blocks completion when a planned set is missing or only marked incomplete", () => {
    const result = evaluateWorkoutCompletion(day, [
      set("squat", 1, 8, 100),
      set("squat", 2, 8, 100),
      set("row", 1, 10, 50),
      set("row", 2, 10, 50, false),
    ]);

    expect(result.canFinish).toBe(false);
    expect(result.completedSetCount).toBe(3);
    expect(result.missingSetKeys).toEqual(["row:2"]);
  });

  it("blocks stray completed logs and never includes them in workout volume", () => {
    const result = evaluateWorkoutCompletion(day, [
      set("squat", 1, 8, 100),
      set("squat", 2, 8, 100),
      set("row", 1, 10, 50),
      set("row", 2, 10, 50),
      set("curl", 1, 10, 999),
    ]);

    expect(result.canFinish).toBe(false);
    expect(result.unexpectedCompletedSetKeys).toEqual(["curl:1"]);
    expect(result.totalVolume).toBe(2600);
  });
});
