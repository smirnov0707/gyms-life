import { describe, expect, it, vi } from "vitest";
import {
  isNetworkUnavailable,
  retainUnacknowledgedWorkoutSets,
  syncPayload,
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
  performedAt: "2026-09-04T19:00:00.000Z",
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

  it("keeps records queued during a flush while removing only acknowledged records", () => {
    const secondSet = { ...firstSet, setNumber: 2 };
    const thirdSet = { ...firstSet, setNumber: 3 };
    const acknowledgedPayload: OfflinePayload = {
      id: "one",
      type: "workout_set",
      data: firstSet,
      timestamp: 1,
    };
    const failedPayload: OfflinePayload = {
      id: "two",
      type: "workout_set",
      data: secondSet,
      timestamp: 2,
    };
    const snapshot = [acknowledgedPayload, failedPayload];
    const queuedDuringFlush: OfflinePayload = {
      id: "three",
      type: "workout_set",
      data: thirdSet,
      timestamp: 3,
    };

    const next = retainUnacknowledgedWorkoutSets(
      snapshot,
      [failedPayload],
      [...snapshot, queuedDuringFlush],
    );

    expect(next).toEqual([failedPayload, queuedDuringFlush]);
  });
});

describe("isNetworkUnavailable", () => {
  it("queues failed writes only for transient connectivity failures", () => {
    expect(isNetworkUnavailable(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkUnavailable(new Error("Workout session is already finished."))).toBe(false);
  });
});

describe("syncPayload", () => {
  it("sends the instant the set was performed", () => {
    const item: OfflinePayload = {
      id: "one",
      type: "workout_set",
      data: firstSet,
      timestamp: Date.parse("2026-09-05T08:00:00.000Z"),
    };
    expect(syncPayload(item).performedAt).toBe("2026-09-04T19:00:00.000Z");
  });

  it("recovers the instant from a queue written before the field existed", () => {
    // Upgrading the app must never silently re-date work already done. An
    // older payload has no performedAt, but its own queue timestamp is that
    // same moment.
    const { performedAt: _dropped, ...legacy } = firstSet;
    const item = {
      id: "one",
      type: "workout_set" as const,
      data: legacy,
      timestamp: Date.parse("2026-09-04T19:00:00.000Z"),
    };
    expect(syncPayload(item).performedAt).toBe("2026-09-04T19:00:00.000Z");
  });
});
