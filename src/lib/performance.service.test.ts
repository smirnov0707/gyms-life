import { describe, expect, it } from "vitest";
import { aggregateExercisePerformance, type PerformanceSetLog } from "./performance.service";

const logs: PerformanceSetLog[] = [
  {
    id: "1",
    session_id: "s1",
    exercise_slug: "bench-press",
    exercise_name: "Bench Press",
    set_number: 1,
    reps: 10,
    weight_kg: 50,
    rpe: 7,
    done: true,
    created_at: "2026-08-01T10:00:00.000Z",
  },
  {
    id: "2",
    session_id: "s1",
    exercise_slug: "bench-press",
    exercise_name: "Bench Press",
    set_number: 2,
    reps: 8,
    weight_kg: 55,
    rpe: 8,
    done: true,
    created_at: "2026-08-01T10:05:00.000Z",
  },
  {
    id: "3",
    session_id: "s2",
    exercise_slug: "bench-press",
    exercise_name: "Bench Press",
    set_number: 1,
    reps: 8,
    weight_kg: 60,
    rpe: 9,
    done: true,
    created_at: "2026-08-08T10:00:00.000Z",
  },
  {
    id: "4",
    session_id: "s2",
    exercise_slug: "bench-press",
    exercise_name: "Bench Press",
    set_number: 2,
    reps: 8,
    weight_kg: 60,
    rpe: 9,
    done: false,
    created_at: "2026-08-08T10:05:00.000Z",
  },
];

describe("performance service", () => {
  it("aggregates only completed sets", () => {
    const result = aggregateExercisePerformance(logs, "bench-press");
    expect(result?.sessions).toBe(2);
    expect(result?.totalSets).toBe(3);
    expect(result?.totalReps).toBe(26);
    expect(result?.totalVolume).toBe(1420);
    expect(result?.bestWeightKg).toBe(60);
    expect(result?.averageRpe).toBe(8);
  });
  it("returns no data for an unknown exercise", () => {
    expect(aggregateExercisePerformance(logs, "squat")).toBeNull();
  });
});
