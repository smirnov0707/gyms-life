import { describe, expect, it } from "vitest";
import {
  parseWorkoutSetLog,
  parseWorkoutSetLogs,
  type WorkoutSetLogRow,
} from "./workout-set-log.schema";

const row: WorkoutSetLogRow = {
  id: "00000000-0000-4000-8000-000000000001",
  session_id: "00000000-0000-4000-8000-000000000002",
  exercise_slug: "barbell-squat",
  exercise_name: "Barbell Squat",
  set_number: 1,
  reps: 8,
  weight_kg: 100,
  rpe: 8,
  done: true,
  created_at: "2026-09-03T04:00:00+00:00",
  performed_at: "2026-09-03T04:00:00+00:00",
};

describe("workout set-log domain contract", () => {
  it("normalizes a database row into a validated domain set", () => {
    expect(parseWorkoutSetLog(row)).toMatchObject({
      sessionId: row.session_id,
      exerciseSlug: "barbell-squat",
      weightKg: 100,
    });
  });

  it("excludes malformed historical rows from downstream consumers", () => {
    expect(parseWorkoutSetLogs([row, { ...row, rpe: 11 }])).toEqual([parseWorkoutSetLog(row)]);
  });
});
