import { describe, expect, it, vi } from "vitest";
import {
  getOfflineQueue,
  isNetworkUnavailable,
  queueWorkoutSet,
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

describe("flushOfflineWorkoutSets", () => {
  let dispatched: string[] = [];

  /** A minimal localStorage, since these paths are browser-only. */
  function stubBrowser(seed: OfflinePayload[]) {
    const store = new Map<string, string>([["gyms_life_offline_queue_v2", JSON.stringify(seed)]]);
    dispatched = [];
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
      },
      // The queue announces every change so the strip that reports undelivered
      // sets can react to one instead of polling local storage.
      dispatchEvent: (event: Event) => {
        dispatched.push(event.type);
        return true;
      },
    });
    vi.stubGlobal(
      "localStorage",
      (globalThis as { window: { localStorage: Storage } }).window.localStorage,
    );
    vi.stubGlobal("navigator", { onLine: true });
    return store;
  }

  it("delivers each queued set once when two screens flush at the same time", async () => {
    // The workout screen has always flushed on `online`. `OfflineQueueSync`
    // now does too, from the authenticated layout, so sets logged in a
    // basement gym still arrive if the athlete never reopens that screen.
    // Two callers must not mean two deliveries.
    const store = stubBrowser([
      { id: "a", type: "workout_set", data: firstSet, timestamp: 1_764_000_000_000 },
      {
        id: "b",
        type: "workout_set",
        data: { ...firstSet, setNumber: 2 },
        timestamp: 1_764_000_060_000,
      },
    ]);

    const delivered: string[] = [];
    const sync = vi.fn(async (input: WorkoutSetSync) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      delivered.push(`${input.exerciseSlug}#${input.setNumber}`);
    });

    const { flushOfflineWorkoutSets } = await import("./offline-store");
    const [first, second] = await Promise.all([
      flushOfflineWorkoutSets(sync),
      flushOfflineWorkoutSets(sync),
    ]);

    expect(sync).toHaveBeenCalledTimes(2);
    expect(delivered).toHaveLength(2);
    // Both callers observe the same finished flush.
    expect(first).toEqual(second);
    expect(first.remaining).toBe(0);
    expect(JSON.parse(store.get("gyms_life_offline_queue_v2") ?? "[]")).toEqual([]);

    vi.unstubAllGlobals();
  });

  it("keeps a set queued when delivery fails, so a reconnect retries it", async () => {
    const store = stubBrowser([
      { id: "a", type: "workout_set", data: firstSet, timestamp: 1_764_000_000_000 },
    ]);
    const { flushOfflineWorkoutSets } = await import("./offline-store");

    const result = await flushOfflineWorkoutSets(async () => {
      throw new Error("Failed to fetch");
    });

    expect(result).toEqual({ synced: 0, remaining: 1 });
    expect(JSON.parse(store.get("gyms_life_offline_queue_v2") ?? "[]")).toHaveLength(1);

    vi.unstubAllGlobals();
  });

  it("announces every change, so the strip reporting undelivered sets can follow", async () => {
    // Sets waiting here are training that happened; every screen in the app
    // reads their absence as training that did not. The strip that says so
    // has to learn when the queue empties without polling local storage.
    stubBrowser([{ id: "a", type: "workout_set", data: firstSet, timestamp: 1_764_000_000_000 }]);
    const { flushOfflineWorkoutSets, OFFLINE_QUEUE_EVENT } = await import("./offline-store");

    await flushOfflineWorkoutSets(async () => undefined);

    expect(dispatched).toContain(OFFLINE_QUEUE_EVENT);
    vi.unstubAllGlobals();
  });
});

describe("a queue that cannot be read", () => {
  /** The same minimal storage, seeded with a raw string rather than a queue. */
  function stubBrowser(raw: string) {
    const store = new Map<string, string>([["gyms_life_offline_queue_v2", raw]]);
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
      },
      dispatchEvent: () => true,
    });
    vi.stubGlobal(
      "localStorage",
      (globalThis as { window: { localStorage: Storage } }).window.localStorage,
    );
    return store;
  }

  const set: WorkoutSetSync = {
    sessionId: "7d1c57b8-0df2-4e87-a7a2-e9a2adf0f6aa",
    exerciseSlug: "barbell-squat",
    exerciseName: "Barbell Squat",
    setNumber: 9,
    reps: 5,
    weightKg: 120,
    rpe: 9,
    done: true,
    performedAt: "2026-09-08T19:00:00.000Z",
  };

  it("keeps the unreadable value instead of writing over it", () => {
    // The defect. `getOfflineQueue` answered a corrupt store with `[]`, and
    // `queueWorkoutSet` built the next queue from that answer — so one bad
    // blob and the next set replaced every set the athlete had logged offline.
    const store = stubBrowser("{ this is not a queue");
    queueWorkoutSet(set);

    expect(store.get("gyms_life_offline_queue_v2.unreadable")).toBe("{ this is not a queue");
    // And the athlete can keep logging: the new set is queued, not refused.
    expect(getOfflineQueue()).toHaveLength(1);
  });

  it("treats a stored value that is not a list as unreadable too", () => {
    const store = stubBrowser(JSON.stringify({ not: "an array" }));
    queueWorkoutSet(set);
    expect(store.get("gyms_life_offline_queue_v2.unreadable")).toBeDefined();
  });

  it("appends normally to a queue it could read", () => {
    const existing: OfflinePayload[] = [
      {
        id: "a",
        type: "workout_set",
        data: { ...set, setNumber: 1 },
        timestamp: 1_764_000_000_000,
      },
    ];
    const store = stubBrowser(JSON.stringify(existing));
    queueWorkoutSet(set);

    expect(getOfflineQueue()).toHaveLength(2);
    // Nothing was salvaged, because nothing was in danger.
    expect(store.get("gyms_life_offline_queue_v2.unreadable")).toBeUndefined();
  });

  it("treats an empty store as readable, not as damaged", () => {
    const store = stubBrowser("[]");
    queueWorkoutSet(set);
    expect(getOfflineQueue()).toHaveLength(1);
    expect(store.get("gyms_life_offline_queue_v2.unreadable")).toBeUndefined();
  });

  it("still drops a single malformed entry without losing its neighbours", () => {
    // The behaviour the file's own comment was written for, unchanged.
    const store = stubBrowser(
      JSON.stringify([
        { id: "a", type: "workout_set", data: set, timestamp: 1_764_000_000_000 },
        { id: "b", nonsense: true },
      ]),
    );
    expect(getOfflineQueue()).toHaveLength(1);
    expect(store.get("gyms_life_offline_queue_v2.unreadable")).toBeUndefined();
  });
});
