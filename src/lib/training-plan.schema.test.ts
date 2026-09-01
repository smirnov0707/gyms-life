import { describe, expect, it } from "vitest";
import { TrainingPlanDataSchema } from "./training-plan.schema";

const validPlan = {
  title: "Strength",
  summary: "Build strength over eight weeks.",
  weeks: "8",
  progression: "Add load when technique remains stable.",
  nutrition: "Prioritize protein and recovery.",
  days: [
    {
      day: "1",
      title: "Upper",
      focus: "Push",
      warmup: "Rows",
      cooldown: "Walk",
      estimated_minutes: "45",
      exercises: [
        {
          slug: "bench-press",
          name: "Bench Press",
          sets: "3",
          reps: 8,
          rest_seconds: "90",
        },
      ],
    },
  ],
};

describe("TrainingPlanDataSchema", () => {
  it("normalizes legacy JSON values into the domain model", () => {
    const plan = TrainingPlanDataSchema.parse(validPlan);

    expect(plan.weeks).toBe(8);
    expect(plan.days[0]?.day).toBe(1);
    expect(plan.days[0]?.exercises[0]?.reps).toBe("8");
    expect(plan.days[0]?.exercises[0]?.notes).toBe("");
  });

  it("rejects invalid program data before it reaches the domain", () => {
    expect(
      TrainingPlanDataSchema.safeParse({ ...validPlan, weeks: 0 }).success,
    ).toBe(false);
  });
});
