import { z } from "zod";
import {
  OFFLINE_DB_NAME,
  OFFLINE_QUEUE_EVENT,
  MAX_QUEUE_ITEMS,
  OfflineQueueError,
  OwnedOfflineItemSchema,
  OwnerIdSchema,
  sameOfflineExecution,
  syncPayload,
  validOfflineAcknowledgement,
  type OwnedOfflineItem,
  type OwnedQueueView,
  type OfflinePayload,
  type WorkoutSetSync,
  type OfflineRetainedReason,
} from "./offline-contract";
import type { OfflineIdentityScope } from "./offline-identity";
const RecoverySchema = z.object({
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  ownerId: OwnerIdSchema,
  itemId: z.string().uuid(),
  status: z.enum(["pending", "acknowledged"]),
});
const STORES = ["pending", "recovery"];
export function notifyOfflineQueue() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OFFLINE_QUEUE_EVENT));
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(OFFLINE_DB_NAME);
      try {
        channel.postMessage({ type: "changed" });
      } finally {
        channel.close();
      }
    }
  } catch {
    // Notification support is optional. A committed local write must never
    // remain pending or be reported as failed because a broadcast was refused.
  }
}
/** Native IndexedDB transactions serialize competing tabs; no shared-array read/replace writes. */
export function createOfflineDatabase(
  factory: () => IDBFactory = () => indexedDB,
  name = OFFLINE_DB_NAME,
) {
  let opening: Promise<IDBDatabase> | null = null;
  function open(): Promise<IDBDatabase> {
    if (opening) return opening;
    const promise = new Promise<IDBDatabase>((resolve, reject) => {
      let request: IDBOpenDBRequest,
        expired = false;
      const fail = () => {
        expired = true;
        reject(new OfflineQueueError("storage_unavailable"));
      };
      const timer = setTimeout(fail, 5000);
      try {
        request = factory().open(name, 1);
      } catch {
        clearTimeout(timer);
        fail();
        return;
      }
      request.onupgradeneeded = () => {
        const db = request.result;
        const pending = db.createObjectStore("pending", { keyPath: "id" });
        pending.createIndex("ownerId", "ownerId");
        const recovery = db.createObjectStore("recovery", { keyPath: "digest" });
        recovery.createIndex("itemId", "itemId");
      };
      request.onblocked = () => {
        clearTimeout(timer);
        fail();
      };
      request.onerror = () => {
        clearTimeout(timer);
        fail();
      };
      request.onsuccess = () => {
        clearTimeout(timer);
        const db = request.result;
        if (expired) {
          db.close();
          return;
        }
        db.onversionchange = () => {
          db.close();
          if (opening === promise) opening = null;
        };
        db.onclose = () => {
          if (opening === promise) opening = null;
        };
        resolve(db);
      };
    });
    opening = promise;
    void promise.catch(() => {
      if (opening === promise) opening = null;
    });
    return promise;
  }
  async function transaction<T>(
    scope: OfflineIdentityScope,
    write: boolean,
    work: (tx: IDBTransaction, done: (value: T) => void, fail: (error?: unknown) => void) => void,
  ): Promise<T> {
    scope.assertCurrent();
    const db = await open();
    scope.assertCurrent();
    return new Promise<T>((resolve, reject) => {
      let tx: IDBTransaction;
      let value: T,
        finished = false,
        reason: unknown;
      try {
        tx = db.transaction(
          STORES,
          write ? "readwrite" : "readonly",
          write ? { durability: "strict" } : undefined,
        );
      } catch {
        reject(new OfflineQueueError("storage_unavailable"));
        return;
      }
      const timer = setTimeout(() => fail(new OfflineQueueError("storage_unavailable")), 10_000);
      const fail = (error: unknown = new OfflineQueueError("storage_rejected")) => {
        reason = error;
        try {
          tx.abort();
        } catch {
          clearTimeout(timer);
          reject(error);
        }
      };
      tx.onabort = () => {
        clearTimeout(timer);
        reject(
          reason instanceof OfflineQueueError ? reason : new OfflineQueueError("storage_rejected"),
        );
      };
      tx.onerror = () => {
        reason ??= new OfflineQueueError("storage_rejected");
      };
      tx.oncomplete = () => {
        clearTimeout(timer);
        if (!finished) {
          reject(new OfflineQueueError("storage_unavailable"));
          return;
        }
        if (write) notifyOfflineQueue();
        resolve(value);
      };
      try {
        work(
          tx,
          (result) => {
            value = result;
            finished = true;
          },
          fail,
        );
      } catch (error) {
        fail(error);
      }
    });
  }
  function scopedRows(
    tx: IDBTransaction,
    scope: OfflineIdentityScope,
    callback: (rows: unknown[]) => void,
    fail: (error?: unknown) => void,
  ) {
    const request = tx.objectStore("pending").index("ownerId").getAll(scope.ownerId);
    request.onsuccess = () => {
      try {
        scope.assertCurrent();
        callback(request.result as unknown[]);
      } catch (error) {
        fail(error);
      }
    };
  }
  function inspect(scope: OfflineIdentityScope, rows: unknown[]): OwnedQueueView {
    const items: OwnedOfflineItem[] = [];
    let invalidCount = 0;
    for (const row of rows) {
      const parsed = OwnedOfflineItemSchema.safeParse(row);
      if (parsed.success && parsed.data.ownerId === scope.ownerId) items.push(parsed.data);
      else invalidCount++;
    }
    items.sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id));
    return { ownerId: scope.ownerId, items, invalidCount };
  }
  return {
    async read(scope: OfflineIdentityScope): Promise<OwnedQueueView> {
      return transaction(scope, false, (tx, done, fail) =>
        scopedRows(tx, scope, (rows) => done(inspect(scope, rows)), fail),
      );
    },
    async add(
      scope: OfflineIdentityScope,
      input: WorkoutSetSync,
      options: { legacy?: { digest: string; source: OfflinePayload } } = {},
    ): Promise<OwnedOfflineItem | null> {
      const timestamp = options.legacy?.source.timestamp ?? Date.now();
      const candidate = OwnedOfflineItemSchema.parse({
        id: crypto.randomUUID(),
        version: 3,
        ownerId: scope.ownerId,
        type: "workout_set",
        timestamp,
        data: { ...input, performedAt: input.performedAt ?? new Date(timestamp).toISOString() },
      });
      const legacy = options.legacy;
      if (legacy)
        z.string()
          .regex(/^[a-f0-9]{64}$/)
          .parse(legacy.digest);
      return transaction(scope, true, (tx, done, fail) => {
        const insert = () =>
          scopedRows(
            tx,
            scope,
            (rows) => {
              const view = inspect(scope, rows);
              const same = view.items.find((row) =>
                sameOfflineExecution(syncPayload(row), candidate.data),
              );
              if (!same && rows.length >= MAX_QUEUE_ITEMS) {
                fail(new OfflineQueueError("queue_full"));
                return;
              }
              const item = same ?? candidate;
              if (!same) tx.objectStore("pending").add(item);
              if (legacy)
                tx.objectStore("recovery").add(
                  RecoverySchema.parse({
                    digest: legacy.digest,
                    ownerId: scope.ownerId,
                    itemId: item.id,
                    status: "pending",
                  }),
                );
              done(item);
            },
            fail,
          );
        if (!legacy) {
          insert();
          return;
        }
        const request = tx.objectStore("recovery").get(legacy.digest);
        request.onsuccess = () => {
          try {
            scope.assertCurrent();
            if (request.result === undefined) {
              insert();
              return;
            }
            const prior = RecoverySchema.safeParse(request.result);
            if (!prior.success) {
              fail(new OfflineQueueError("storage_unavailable"));
              return;
            }
            // Never adopt again after acknowledgement, or bind one row to a second identity.
            done(null);
          } catch (error) {
            fail(error);
          }
        };
      });
    },
    async acknowledge(
      scope: OfflineIdentityScope,
      item: OwnedOfflineItem,
      reply: unknown,
    ): Promise<boolean> {
      if (item.ownerId !== scope.ownerId || !validOfflineAcknowledgement(item, reply)) return false;
      return transaction(scope, true, (tx, done, fail) => {
        const request = tx.objectStore("pending").get(item.id);
        request.onsuccess = () => {
          try {
            scope.assertCurrent();
            const current = OwnedOfflineItemSchema.safeParse(request.result);
            if (
              !current.success ||
              current.data.ownerId !== scope.ownerId ||
              !sameOfflineExecution(syncPayload(current.data), syncPayload(item))
            ) {
              done(false);
              return;
            }
            const imports = tx.objectStore("recovery").index("itemId").getAll(item.id);
            imports.onsuccess = () => {
              try {
                scope.assertCurrent();
                for (const row of imports.result as unknown[]) {
                  const receipt = RecoverySchema.parse(row);
                  if (receipt.ownerId !== scope.ownerId)
                    throw new OfflineQueueError("storage_unavailable");
                  tx.objectStore("recovery").put({ ...receipt, status: "acknowledged" });
                }
                tx.objectStore("pending").delete(item.id);
                done(true);
              } catch (error) {
                fail(error);
              }
            };
          } catch (error) {
            fail(error);
          }
        };
      });
    },
    async retain(
      scope: OfflineIdentityScope,
      item: OwnedOfflineItem,
      lastFailure: OfflineRetainedReason,
    ): Promise<void> {
      return transaction(scope, true, (tx, done, fail) => {
        const request = tx.objectStore("pending").get(item.id);
        request.onsuccess = () => {
          try {
            scope.assertCurrent();
            const current = OwnedOfflineItemSchema.safeParse(request.result);
            if (
              current.success &&
              current.data.ownerId === scope.ownerId &&
              sameOfflineExecution(syncPayload(current.data), syncPayload(item))
            )
              tx.objectStore("pending").put({ ...current.data, lastFailure });
            done(undefined);
          } catch (error) {
            fail(error);
          }
        };
      });
    },
    async close() {
      const current = opening;
      opening = null;
      if (current) (await current).close();
    },
  };
}
export const offlineDatabase = createOfflineDatabase();
