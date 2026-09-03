import { describe, expect, it } from "vitest";
import { ArWorkoutInputSchema } from "./ar-workout.schema";

const validInput = {
  sessionId: "f154ee80-6ae5-4a82-b629-c3c2119f6fd2",
  exerciseSlug: "overhead-press",
  exerciseName: "Spaudimas virš galvos",
  reps: 8,
  weightKg: 42.5,
  notes: "Stabili technika.",
};

describe("ArWorkoutInputSchema", () => {
  it("normalizes bounded camera-set input before it reaches the database", () => {
    expect(ArWorkoutInputSchema.parse({ ...validInput, reps: "8", weightKg: "42.5" })).toEqual(
      validInput,
    );
  });

  it("rejects malformed exercise slugs and unsafe metrics", () => {
    expect(
      ArWorkoutInputSchema.safeParse({ ...validInput, exerciseSlug: "Squat <script>" }).success,
    ).toBe(false);
    expect(ArWorkoutInputSchema.safeParse({ ...validInput, reps: 0 }).success).toBe(false);
    expect(ArWorkoutInputSchema.safeParse({ ...validInput, weightKg: 1001 }).success).toBe(false);
  });
});
