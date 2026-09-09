import { offlineDatabase } from "./offline-database";
import { offlineIdentity, type OfflineIdentityScope } from "./offline-identity";
import {
  OFFLINE_DB_NAME,
  OfflineQueueError,
  OwnerIdSchema,
  type WorkoutSetSync,
  type OwnedQueueView,
  type OfflineSyncRequest,
  type OfflineSyncResult,
} from "./offline-contract";
import { readLegacyOffline, type LegacyOfflineView } from "./offline-legacy";
import { synchronizeOwnedOffline, recoverVerifiedLegacy } from "./offline-sync.engine";
export {
  WorkoutSetSyncSchema,
  OfflinePayloadSchema,
  OFFLINE_QUEUE_EVENT,
  OfflineQueueError,
  syncPayload,
  type WorkoutSetSync,
  type OfflinePayload,
  type OwnedOfflineItem,
  type OfflineSyncResult,
} from "./offline-contract";
const flushes = new Map<string, Promise<OfflineSyncResult>>();
export async function getOfflineQueue(ownerId: string): Promise<OwnedQueueView> {
  return offlineDatabase.read(offlineIdentity.capture(ownerId));
}
export async function queueWorkoutSet(input: WorkoutSetSync, ownerId: string) {
  const item = await offlineDatabase.add(offlineIdentity.capture(ownerId), input);
  if (!item) throw new OfflineQueueError("storage_rejected");
  return item;
}
export async function hasQueuedWorkoutSets(sessionId: string, ownerId: string): Promise<boolean> {
  const queue = await getOfflineQueue(ownerId);
  if (queue.invalidCount) throw new OfflineQueueError("storage_unavailable");
  return queue.items.some((item) => item.data.sessionId === sessionId);
}
export function inspectLegacyOffline(): LegacyOfflineView {
  if (typeof window === "undefined")
    return { status: "absent", items: [], invalidCount: 0, limited: false };
  try {
    return readLegacyOffline(localStorage);
  } catch {
    return { status: "unavailable", items: [], invalidCount: 0, limited: false };
  }
}
export async function recoverLegacyOfflineSets(
  ownerId: string,
  verify: (input: { ownerId: string; sessionIds: string[] }) => Promise<unknown>,
) {
  const scope = offlineIdentity.capture(ownerId);
  if (typeof navigator === "undefined" || !navigator.onLine)
    throw new Error("OFFLINE_SYNC_UNAVAILABLE");
  return recoverVerifiedLegacy(scope, inspectLegacyOffline(), offlineDatabase, verify);
}
export function flushOfflineWorkoutSets(
  ownerId: string,
  send: (input: OfflineSyncRequest) => Promise<unknown>,
): Promise<OfflineSyncResult> {
  const scope = offlineIdentity.capture(ownerId),
    key = `${scope.ownerId}:${scope.epoch}`;
  const current = flushes.get(key);
  if (current) return current;
  const execute = () =>
    synchronizeOwnedOffline(
      scope,
      offlineDatabase,
      send,
      () => typeof navigator !== "undefined" && navigator.onLine,
    );
  const operation = async () => {
    // A cross-tab lock reduces duplicate deliveries, but durability does not rely
    // on its presence. Transactions plus server identity/idempotency checks remain authoritative.
    if (typeof navigator !== "undefined" && navigator.locks) {
      return navigator.locks.request(
        `${OFFLINE_DB_NAME}:sync:${ownerId}`,
        { ifAvailable: true },
        async (lock) => {
          scope.assertCurrent();
          if (lock) return execute();
          const view = await offlineDatabase.read(scope);
          return {
            ownerId,
            synced: 0,
            remaining: view.items.length,
            invalidCount: view.invalidCount,
            cancelled: false,
            busy: true,
          };
        },
      );
    }
    return execute();
  };
  const promise = operation();
  flushes.set(key, promise);
  const clear = () => {
    if (flushes.get(key) === promise) flushes.delete(key);
  };
  void promise.then(clear, clear);
  return promise;
}
export function isNetworkUnavailable(error: unknown): boolean {
  if (
    error instanceof OfflineQueueError ||
    (error instanceof Error && error.message.startsWith("OFFLINE_IDENTITY"))
  )
    return false;
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (error instanceof TypeError) return true;
  return (
    error instanceof Error &&
    /network|fetch failed|failed to fetch|connection|offline/i.test(error.message)
  );
}
