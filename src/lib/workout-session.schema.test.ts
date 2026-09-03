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
