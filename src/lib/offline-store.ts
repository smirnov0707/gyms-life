import { z } from "zod";

const STORAGE_KEY = "gyms_life_offline_queue_v2";
const MAX_QUEUE_ITEMS = 200;

export const WorkoutSetSyncSchema = z.object({
  sessionId: z.string().uuid(),
  exerciseSlug: z.string().min(1).max(120),
  exerciseName: z.string().min(1).max(200),
  setNumber: z.number().int().positive(),
  reps: z.number().int().positive().nullable(),
  weightKg: z.number().nonnegative().nullable(),
  rpe: z.number().min(0).max(10).nullable(),
  done: z.boolean(),
  /**
   * When the set was performed. Carried in the payload rather than left to
   * the server clock: a queued set may not reach the server for hours, and
   * the Twin decays fatigue from this instant.
   *
   * Optional because a queue written by an earlier version of the app has no
   * such field, and those are real sets someone performed. `syncPayload`
   * recovers their instant from the payload's own `timestamp`.
   */
  performedAt: z.string().datetime().optional(),
});

export type WorkoutSetSync = z.infer<typeof WorkoutSetSyncSchema>;

const OfflinePayloadSchema = z.object({
  id: z.string().min(1),
  type: z.literal("workout_set"),
  data: WorkoutSetSyncSchema,
  timestamp: z.number().int().nonnegative(),
});

export type OfflinePayload = z.infer<typeof OfflinePayloadSchema>;

export type OfflineSyncResult = {
  synced: number;
  remaining: number;
};

let activeWorkoutSetFlush: Promise<OfflineSyncResult> | null = null;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function createPayloadId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function persistOfflineQueue(queue: OfflinePayload[]): void {
  if (!isBrowser()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

/**
 * The instant a queued set was performed.
 *
 * A payload written before `performedAt` existed still recorded the moment it
 * was queued, which is the same instant. Recovering it there means upgrading
 * the app never silently re-dates work someone already did.
 */
export function syncPayload(item: OfflinePayload): WorkoutSetSync {
  if (item.data.performedAt !== undefined) return item.data;
  return { ...item.data, performedAt: new Date(item.timestamp).toISOString() };
}

/**
 * Returns only validated records; malformed local storage never reaches the
 * server. Records are validated one at a time: a single unreadable entry used
 * to discard the whole queue, which meant losing every other set in it.
 */
export function getOfflineQueue(): OfflinePayload[] {
  if (!isBrowser()) return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const rows = JSON.parse(raw);
    if (!Array.isArray(rows)) return [];
    return rows.flatMap((row) => {
      const parsed = OfflinePayloadSchema.safeParse(row);
      return parsed.success ? [parsed.data] : [];
    });
  } catch {
    return [];
  }
}

export function queueWorkoutSet(input: WorkoutSetSync): OfflinePayload {
  const data = WorkoutSetSyncSchema.parse(input);
  const queue = getOfflineQueue();
  if (queue.length >= MAX_QUEUE_ITEMS) {
    throw new Error("Offline workout queue is full. Reconnect to sync your saved sets.");
  }

  const payload: OfflinePayload = {
    id: createPayloadId(),
    type: "workout_set",
    data,
    timestamp: Date.now(),
  };
  persistOfflineQueue([...queue, payload]);
  return payload;
}

export function hasQueuedWorkoutSets(sessionId: string): boolean {
  return getOfflineQueue().some((item) => item.data.sessionId === sessionId);
}

/**
 * Synchronizes in order and keeps only items that could not be delivered.
 * The server endpoint is idempotent, so a retry after a lost response is safe.
 */
export async function synchronizeWorkoutSets(
  queue: OfflinePayload[],
  sync: (input: WorkoutSetSync) => Promise<unknown>,
): Promise<{ synced: number; remaining: OfflinePayload[] }> {
  const remaining: OfflinePayload[] = [];
  let synced = 0;

  for (const item of queue) {
    try {
      await sync(syncPayload(item));
      synced += 1;
    } catch {
      remaining.push(item);
    }
  }

  return { synced, remaining };
}

/**
 * Removes only records acknowledged from this synchronization snapshot. Records
 * appended while a flush was in flight are retained for the next flush.
 */
export function retainUnacknowledgedWorkoutSets(
  snapshot: OfflinePayload[],
  failed: OfflinePayload[],
  current: OfflinePayload[],
): OfflinePayload[] {
  const failedIds = new Set(failed.map((item) => item.id));
  const acknowledgedIds = new Set(
    snapshot.filter((item) => !failedIds.has(item.id)).map((item) => item.id),
  );

  return current.filter((item) => !acknowledgedIds.has(item.id));
}

export function flushOfflineWorkoutSets(
  sync: (input: WorkoutSetSync) => Promise<unknown>,
): Promise<OfflineSyncResult> {
  if (!isBrowser() || !navigator.onLine) {
    return Promise.resolve({ synced: 0, remaining: getOfflineQueue().length });
  }
  if (activeWorkoutSetFlush) return activeWorkoutSetFlush;

  const snapshot = getOfflineQueue();
  const flush = synchronizeWorkoutSets(snapshot, sync).then(({ synced, remaining }) => {
    const queue = retainUnacknowledgedWorkoutSets(snapshot, remaining, getOfflineQueue());
    persistOfflineQueue(queue);
    return { synced, remaining: queue.length };
  });

  activeWorkoutSetFlush = flush;
  void flush.then(
    () => {
      if (activeWorkoutSetFlush === flush) activeWorkoutSetFlush = null;
    },
    () => {
      if (activeWorkoutSetFlush === flush) activeWorkoutSetFlush = null;
    },
  );
  return flush;
}

export function isNetworkUnavailable(error: unknown): boolean {
  if (isBrowser() && !navigator.onLine) return true;
  if (error instanceof TypeError) return true;
  if (!(error instanceof Error)) return false;

  return /network|fetch failed|failed to fetch|connection|offline/i.test(error.message);
}
