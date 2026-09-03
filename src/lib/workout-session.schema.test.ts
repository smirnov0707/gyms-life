import { describe, expect, it } from "vitest";
import {
  parseCompletedWorkoutSessions,
  parseWorkoutSession,
  type WorkoutSessionRow,
} from "./workout-session.schema";

const row: WorkoutSessionRow = {
  id: "00000000-0000-4000-8000-000000000001",
  plan_id: "00000000-0000-4000-8000-000000000002",
  day_index: 0,
  title: "Upper strength",
  started_at: "2026-09-03T04:00:00+00:00",
  finished_at: null,
  duration_seconds: null,
  total_volume: 0,
  adaptation_modifier: 0.9,
  workout_snapshot: null,
};

describe("workout session domain contract", () => {
  it("normalizes a selected database row into a validated domain session", () => {
    expect(parseWorkoutSession(row)).toMatchObject({
      planId: row.plan_id,
      dayIndex: 0,
      startedAt: row.started_at,
      adaptationModifier: 0.9,
    });
  });

  it("rejects database values outside the persisted readiness contract", () => {
    expect(() => parseWorkoutSession({ ...row, adaptation_modifier: 1.2 })).toThrow();
  });

  it("keeps a validated execution snapshot and rejects malformed JSON", () => {
    const workoutSnapshot = {
      version: "1.0",
      workout: {
        day: 1,
        title: "Upper strength",
        focus: "Strength",
        warmup: "Rows",
        cooldown: "Walk",
        estimated_minutes: 30,
        exercises: [
          {
            slug: "push-up",
            name: "Push-Up",
            sets: 2,
            reps: "8-12",
            rest_seconds: 60,
            notes: "",
          },
        ],
      },
      adaptation: {
        version: "1.0",
        readinessModifier: 0.9,
        reasons: ["time_limit"],
        sourceContextIds: ["00000000-0000-4000-8000-000000000099"],
        timeBudgetMinutes: 30,
        substitutions: [],
        omittedExerciseSlugs: [],
      },
    };

    expect(
      parseWorkoutSession({ ...row, workout_snapshot: workoutSnapshot }).workoutSnapshot,
    ).toEqual(
      expect.objectContaining({ workout: expect.objectContaining({ estimated_minutes: 30 }) }),
    );
    expect(() => parseWorkoutSession({ ...row, workout_snapshot: { version: "1.0" } })).toThrow();
  });

  it("excludes unfinished and malformed rows from completed-performance consumers", () => {
    const complete = {
      ...row,
      finished_at: "2026-09-03T05:00:00+00:00",
      duration_seconds: 3_600,
      total_volume: 1_200,
    };

    expect(
      parseCompletedWorkoutSessions([complete, row, { ...complete, total_volume: -1 }]),
    ).toEqual([expect.objectContaining({ id: complete.id, finishedAt: complete.finished_at })]);
  });
});
