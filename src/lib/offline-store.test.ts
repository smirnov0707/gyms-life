import { describe, expect, it, vi } from "vitest";
import {
  isNetworkUnavailable,
  synchronizeWorkoutSets,
  type OfflinePayload,
  type WorkoutSetSync,
} from "./offline-store";

const firstSet: WorkoutSetSync = {
  sessionId: "7d1c57b8-0df2-4e87-a7a2-e9a2adf0f6aa",
  exerciseSlug: "barbell-squat",
  exerciseName: "Barbell Squat",
  setNumber: 1,
  reps: 8,
  weightKg: 100,
  rpe: 8,
  done: true,
};

describe("synchronizeWorkoutSets", () => {
  it("removes acknowledged sets and preserves only failed deliveries for a later retry", async () => {
    const secondSet = { ...firstSet, setNumber: 2 };
    const queue: OfflinePayload[] = [
      { id: "one", type: "workout_set", data: firstSet, timestamp: 1 },
      { id: "two", type: "workout_set", data: secondSet, timestamp: 2 },
    ];
    const sync = vi.fn(async (input: WorkoutSetSync) => {
      if (input.setNumber === 2) throw new Error("network unavailable");
    });

    const result = await synchronizeWorkoutSets(queue, sync);

    expect(result.synced).toBe(1);
    expect(result.remaining).toEqual([queue[1]]);
    expect(sync).toHaveBeenCalledTimes(2);
  });
});

describe("isNetworkUnavailable", () => {
  it("queues failed writes only for transient connectivity failures", () => {
    expect(isNetworkUnavailable(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkUnavailable(new Error("Workout session is already finished."))).toBe(false);
  });
});
