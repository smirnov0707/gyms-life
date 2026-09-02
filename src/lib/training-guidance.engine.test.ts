import { describe, expect, it } from "vitest";
import { buildExerciseTrainingGuidance } from "./training-guidance.engine";

const set = (sessionId: string, setNumber: number, reps: number, rpe = 8, weightKg = 75) => ({
  sessionId,
  finishedAt: `2026-09-0${sessionId}T10:00:00.000Z`,
  setNumber,
  reps,
  rpe,
  weightKg,
});

describe("training guidance engine", () => {
  it("waits for a weighted baseline before making a load recommendation", () => {
    expect(
      buildExerciseTrainingGuidance({
        exerciseSlug: "bench-press",
        plannedSets: 3,
        plannedReps: "8-10",
        readinessModifier: 1,
        history: [],
      }).action,
    ).toBe("LOG_BASELINE");
  });

  it("suggests a conservative increase only after two complete, low-RPE sessions", () => {
    const result = buildExerciseTrainingGuidance({
      exerciseSlug: "bench-press",
      plannedSets: 3,
      plannedReps: "8-10",
      readinessModifier: 1,
      history: [
        set("1", 1, 10),
        set("1", 2, 10),
        set("1", 3, 10),
        set("2", 1, 10),
        set("2", 2, 10),
        set("2", 3, 10),
      ],
    });

    expect(result.action).toBe("INCREASE_LOAD");
    expect(result.suggestedWeightKg).toBe(77.5);
  });

  it("lets low readiness override an otherwise eligible load increase", () => {
    const result = buildExerciseTrainingGuidance({
      exerciseSlug: "bench-press",
      plannedSets: 3,
      plannedReps: "8-10",
      readinessModifier: 0.8,
      history: [
        set("1", 1, 10),
        set("1", 2, 10),
        set("1", 3, 10),
        set("2", 1, 10),
        set("2", 2, 10),
        set("2", 3, 10),
      ],
    });

    expect(result.action).toBe("REDUCE_LOAD");
    expect(result.suggestedWeightKg).toBe(60);
    expect(result.adjustedSets).toBe(2);
  });

  it("backs off after a high-effort target miss", () => {
    const result = buildExerciseTrainingGuidance({
      exerciseSlug: "squat",
      plannedSets: 3,
      plannedReps: "6-8",
      readinessModifier: 1,
      history: [set("1", 1, 5, 9, 100), set("1", 2, 5, 9, 100), set("1", 3, 5, 9, 100)],
    });

    expect(result.action).toBe("REDUCE_LOAD");
    expect(result.suggestedWeightKg).toBe(95);
  });
});
