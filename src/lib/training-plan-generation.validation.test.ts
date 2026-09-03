import { describe, expect, it } from "vitest";
import { TrainingPlanDataSchema } from "./training-plan.schema";
import { validateGeneratedTrainingPlan } from "./training-plan-generation.validation";

const exercise = (slug: string, name: string) => ({
  slug,
  name,
  sets: 3,
  reps: "8",
  rest_seconds: 90,
});

const catalog = [
  "squat",
  "romanian-deadlift",
  "leg-press",
  "calf-raise",
  "bench-press",
  "row",
  "overhead-press",
  "lat-pulldown",
];

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
      exercises: [
        exercise("squat", "Squat"),
        exercise("romanian-deadlift", "Romanian deadlift"),
        exercise("leg-press", "Leg press"),
        exercise("calf-raise", "Calf raise"),
      ],
    },
    {
      day: 2,
      title: "Upper",
      focus: "Push",
      warmup: "Rows",
      cooldown: "Walk",
      estimated_minutes: 45,
      exercises: [
        exercise("bench-press", "Bench press"),
        exercise("row", "Row"),
        exercise("overhead-press", "Overhead press"),
        exercise("lat-pulldown", "Lat pulldown"),
      ],
    },
  ],
});

describe("generated training-plan validation", () => {
  it("accepts requested days with 4-6 unique catalog exercises", () => {
    expect(validateGeneratedTrainingPlan(plan, 2, catalog)).toBe(plan);
  });

  it("rejects a plan that cannot connect to the exercise library", () => {
    const unavailable = {
      ...plan,
      days: [
        {
          ...plan.days[0]!,
          exercises: [
            { ...plan.days[0]!.exercises[0]!, slug: "made-up-exercise" },
            ...plan.days[0]!.exercises.slice(1),
          ],
        },
        plan.days[1]!,
      ],
    };
    expect(() => validateGeneratedTrainingPlan(unavailable, 2, catalog)).toThrow(
      "outside the available catalog",
    );
  });

  it("rejects an incomplete weekly schedule even when every exercise is valid", () => {
    expect(() => validateGeneratedTrainingPlan(plan, 3, catalog)).toThrow("requested workout days");
  });

  it("rejects a daily workout that is too sparse or too long", () => {
    const tooSparse = {
      ...plan,
      days: [{ ...plan.days[0]!, exercises: plan.days[0]!.exercises.slice(0, 3) }, plan.days[1]!],
    };
    const tooLong = {
      ...plan,
      days: [
        {
          ...plan.days[0]!,
          exercises: [...plan.days[0]!.exercises, ...plan.days[1]!.exercises.slice(0, 3)],
        },
        plan.days[1]!,
      ],
    };

    expect(() => validateGeneratedTrainingPlan(tooSparse, 2, catalog)).toThrow("4–6 exercises");
    expect(() => validateGeneratedTrainingPlan(tooLong, 2, catalog)).toThrow("4–6 exercises");
  });

  it("rejects duplicate exercises within the same workout day", () => {
    const repeatedExercise = {
      ...plan,
      days: [
        {
          ...plan.days[0]!,
          exercises: [
            plan.days[0]!.exercises[0]!,
            plan.days[0]!.exercises[0]!,
            ...plan.days[0]!.exercises.slice(2),
          ],
        },
        plan.days[1]!,
      ],
    };

    expect(() => validateGeneratedTrainingPlan(repeatedExercise, 2, catalog)).toThrow(
      "repeats an exercise",
    );
  });
});
