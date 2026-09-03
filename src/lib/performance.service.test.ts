import { describe, expect, it } from "vitest";
import { aggregateExercisePerformance, type PerformanceSetLog } from "./performance.service";

const logs: PerformanceSetLog[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    sessionId: "00000000-0000-4000-8000-000000000101",
    exerciseSlug: "bench-press",
    exerciseName: "Bench Press",
    setNumber: 1,
    reps: 10,
    weightKg: 50,
    rpe: 7,
    done: true,
    createdAt: "2026-08-01T10:00:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    sessionId: "00000000-0000-4000-8000-000000000101",
    exerciseSlug: "bench-press",
    exerciseName: "Bench Press",
    setNumber: 2,
    reps: 8,
    weightKg: 55,
    rpe: 8,
    done: true,
    createdAt: "2026-08-01T10:05:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    sessionId: "00000000-0000-4000-8000-000000000102",
    exerciseSlug: "bench-press",
    exerciseName: "Bench Press",
    setNumber: 1,
    reps: 8,
    weightKg: 60,
    rpe: 9,
    done: true,
    createdAt: "2026-08-08T10:00:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000004",
    sessionId: "00000000-0000-4000-8000-000000000102",
    exerciseSlug: "bench-press",
    exerciseName: "Bench Press",
    setNumber: 2,
    reps: 8,
    weightKg: 60,
    rpe: 9,
    done: false,
    createdAt: "2026-08-08T10:05:00.000Z",
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
