import { describe, expect, it } from "vitest";
import {
  normalizeActivePlan,
  selectNextPlanWorkout,
  type ActivePlanRow,
  type ActiveTrainingPlan,
} from "./active-plan.service";
import type { TrainingPlanData } from "./training-plan.schema";

const rawPlanData: TrainingPlanData = {
  title: "Strength",
  summary: "Build strength.",
  weeks: 8,
  progression: "Add load.",
  nutrition: "Eat enough protein.",
  days: [
    {
      day: 1,
      title: "Upper body",
      focus: "Strength",
      warmup: "Rows",
      cooldown: "Walk",
      estimated_minutes: 45,
      exercises: [
        {
          slug: "bench-press",
          name: "Bench press",
          sets: 3,
          reps: "8",
          rest_seconds: 90,
          notes: "Keep the bar path controlled.",
        },
      ],
    },
  ],
};

const rawPlan: ActivePlanRow = {
  id: "00000000-0000-4000-8000-000000000001",
  title: "Strength",
  goal: "strength",
  weeks: 8,
  days_per_week: 1,
  created_at: "2026-09-01T00:00:00.000Z",
  data: rawPlanData,
};

describe("normalizeActivePlan", () => {
  it("creates a validated domain plan from a raw database row", () => {
    const result = normalizeActivePlan(rawPlan);

    expect("status" in result).toBe(false);
    if (!("status" in result)) {
      expect(result.data.title).toBe("Strength");
      expect(result.daysPerWeek).toBe(1);
    }
  });

  it("returns an invalid-data state instead of asserting raw JSON", () => {
    const result = normalizeActivePlan({
      ...rawPlan,
      data: { title: "Incomplete" },
    });

    expect(result).toMatchObject({ status: "INVALID_PLAN", planId: rawPlan.id });
  });

  it("rejects an invalid persisted weekly frequency before it reaches Today decisions", () => {
    const result = normalizeActivePlan({ ...rawPlan, days_per_week: 0 });

    expect(result).toMatchObject({ status: "INVALID_PLAN", planId: rawPlan.id });
  });

  it("rejects an active plan whose metadata does not match its validated JSON program", () => {
    const result = normalizeActivePlan({ ...rawPlan, days_per_week: 2 });

    expect(result).toMatchObject({ status: "INVALID_PLAN", planId: rawPlan.id });
  });

  it("rejects a program that skips a day even when its day count matches", () => {
    const result = normalizeActivePlan({
      ...rawPlan,
      data: {
        ...rawPlanData,
        days: [{ ...rawPlanData.days[0]!, day: 2 }],
      },
    });

    expect(result).toMatchObject({ status: "INVALID_PLAN", planId: rawPlan.id });
  });
});

describe("selectNextPlanWorkout", () => {
  function planWithThreeDays(): ActiveTrainingPlan {
    const result = normalizeActivePlan(rawPlan);
    if ("status" in result) throw new Error("Expected a valid active plan.");
    const firstDay = result.data.days[0];
    if (!firstDay) throw new Error("Expected a first program day.");

    return {
      ...result,
      daysPerWeek: 3,
      data: {
        ...result.data,
        days: [
          { ...firstDay, day: 3, title: "Day three" },
          { ...firstDay, day: 1, title: "Day one" },
          { ...firstDay, day: 2, title: "Day two" },
        ],
      },
    };
  }

  it("starts from the first ordered program day without inventing a calendar day", () => {
    expect(
      selectNextPlanWorkout(planWithThreeDays(), {
        openDayIndex: null,
        lastCompletedDayIndex: null,
      }),
    ).toMatchObject({ day: 1, title: "Day one" });
  });

  it("resumes an unfinished program day before advancing the sequence", () => {
    expect(
      selectNextPlanWorkout(planWithThreeDays(), {
        openDayIndex: 1,
        lastCompletedDayIndex: 0,
      }),
    ).toMatchObject({ day: 2, title: "Day two" });
  });

  it("advances from the latest completed day and wraps after the final day", () => {
    const plan = planWithThreeDays();
    expect(
      selectNextPlanWorkout(plan, { openDayIndex: null, lastCompletedDayIndex: 1 }),
    ).toMatchObject({ day: 3, title: "Day three" });
    expect(
      selectNextPlanWorkout(plan, { openDayIndex: null, lastCompletedDayIndex: 2 }),
    ).toMatchObject({ day: 1, title: "Day one" });
  });
});
