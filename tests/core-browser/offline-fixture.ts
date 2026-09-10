// Native outbox helpers exposed only by synthetic browser fixtures.
import { getOfflineQueue, queueWorkoutSet } from "../../src/lib/offline-store";
import { offlineIdentity } from "../../src/lib/offline-identity";
import { syncPayload, type OfflinePayload } from "../../src/lib/offline-contract";
const owner = () => {
  const id = offlineIdentity.current();
  if (!id) throw new Error("Synthetic owner unavailable");
  return id;
};
export const offlineFixture = {
  read: async () => (await getOfflineQueue(owner())).items,
  seed: async (rows: OfflinePayload[]) => {
    for (const row of rows) await queueWorkoutSet(syncPayload(row), owner());
  },
  rejectWrites: () => {
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (storeNames, mode, options) {
      if (mode === "readwrite")
        throw new DOMException("Synthetic full storage", "QuotaExceededError");
      return original.call(this, storeNames, mode ?? "readonly", options);
    };
  },
};
Object.assign(window, { __offlineFixture: offlineFixture });
