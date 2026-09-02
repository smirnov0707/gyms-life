import { describe, expect, it } from "vitest";
import { TrainingPlanDataSchema } from "./training-plan.schema";
import { validateGeneratedTrainingPlan } from "./training-plan-generation.validation";

const plan = TrainingPlanDataSchema.parse({
  title: "Strength plan",
  summary: "Progressive strength work.",
  weeks: 8,
  progression: "Increase load gradually.",
  nutrition: "Prioritize protein.",
  days: [
    {
      day: 1,
      title: "Lower",
      focus: "Legs",
      warmup: "Walk",
      cooldown: "Stretch",
      estimated_minutes: 45,
      exercises: [{ slug: "squat", name: "Squat", sets: 3, reps: "8", rest_seconds: 90 }],
    },
    {
      day: 2,
      title: "Upper",
      focus: "Push",
      warmup: "Rows",
      cooldown: "Walk",
      estimated_minutes: 45,
      exercises: [
        { slug: "bench-press", name: "Bench press", sets: 3, reps: "8", rest_seconds: 90 },
      ],
    },
  ],
});

describe("generated training-plan validation", () => {
  it("accepts requested days made only from catalog exercises", () => {
    expect(validateGeneratedTrainingPlan(plan, 2, ["squat", "bench-press"])).toBe(plan);
  });

  it("rejects a plan that cannot connect to the exercise library", () => {
    const unavailable = {
      ...plan,
      days: [
        {
          ...plan.days[0]!,
          exercises: [{ ...plan.days[0]!.exercises[0]!, slug: "made-up-exercise" }],
        },
        plan.days[1]!,
      ],
    };
    expect(() => validateGeneratedTrainingPlan(unavailable, 2, ["squat", "bench-press"])).toThrow(
      "outside the available catalog",
    );
  });

  it("rejects an incomplete weekly schedule even when every exercise is valid", () => {
    expect(() => validateGeneratedTrainingPlan(plan, 3, ["squat", "bench-press"])).toThrow(
      "requested workout days",
    );
  });
});
