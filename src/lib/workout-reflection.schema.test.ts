import { describe, expect, it } from "vitest";
import { WorkoutReflectionInputSchema, parseWorkoutReflection } from "./workout-reflection.schema";

const sessionId = "00000000-0000-4000-8000-000000000001";

describe("workout reflection contract", () => {
  it("accepts only the bounded, user-reported workout signal", () => {
    expect(WorkoutReflectionInputSchema.parse({ sessionId, feeling: 4 })).toEqual({
      sessionId,
      feeling: 4,
    });
    expect(WorkoutReflectionInputSchema.safeParse({ sessionId, feeling: 0 }).success).toBe(false);
    expect(WorkoutReflectionInputSchema.safeParse({ sessionId, feeling: 6 }).success).toBe(false);
    expect(
      WorkoutReflectionInputSchema.safeParse({ sessionId, feeling: 3, userId: sessionId }).success,
    ).toBe(false);
  });

  it("maps a validated completed-session row into the application contract", () => {
    expect(
      parseWorkoutReflection({
        id: sessionId,
        feeling: 3,
        finished_at: "2026-09-03T10:15:00.000Z",
      }),
    ).toEqual({
      sessionId,
      feeling: 3,
      finishedAt: "2026-09-03T10:15:00.000Z",
    });
  });

  it("does not accept unfinished or malformed database rows", () => {
    expect(() =>
      parseWorkoutReflection({ id: sessionId, feeling: 3, finished_at: null }),
    ).toThrow();
    expect(() =>
      parseWorkoutReflection({
        id: sessionId,
        feeling: 9,
        finished_at: "2026-09-03T10:15:00.000Z",
      }),
    ).toThrow();
  });
});
