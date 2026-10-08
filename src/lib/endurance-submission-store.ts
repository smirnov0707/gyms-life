import { ManualRunSubmissionSchema, type ManualRunSubmission } from "./endurance-submission.schema";
import type { OfflineIdentityScope } from "./offline-identity";

export const RUN_SUBMISSION_DB = "gyms_life_run_submission_v1";
export class RunSubmissionStorageError extends Error {
  constructor(readonly reason: "unavailable" | "invalid" | "pending_exists") {
    super(`RUN_SUBMISSION_STORAGE_${reason.toUpperCase()}`);
  }
}
/** Pending request transport journal only; no activity history, tokens or statistics. */
export function createRunSubmissionStore(factory: () => IDBFactory = () => indexedDB) {
  const open = () =>
    new Promise<IDBDatabase>((resolve, reject) => {
      let expired = false;
      const fail = () => {
        expired = true;
        reject(new RunSubmissionStorageError("unavailable"));
      };
      const timer = setTimeout(fail, 5000);
      try {
        const request = factory().open(RUN_SUBMISSION_DB, 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore("pending", { keyPath: "ownerId" });
        request.onerror = request.onblocked = () => {
          clearTimeout(timer);
          fail();
        };
        request.onsuccess = () => {
          clearTimeout(timer);
          if (expired) {
            request.result.close();
            return;
          }
          resolve(request.result);
        };
      } catch {
        clearTimeout(timer);
        fail();
      }
    });
  async function transaction(
    scope: OfflineIdentityScope,
    mode: "read" | "begin" | "ack",
    request?: ManualRunSubmission,
  ) {
    scope.assertCurrent();
    const db = await open();
    try {
      scope.assertCurrent();
    } catch (error) {
      db.close();
      throw error;
    }
    return new Promise<ManualRunSubmission | null>((resolve, reject) => {
      let tx: IDBTransaction;
      try {
        tx = db.transaction("pending", mode === "read" ? "readonly" : "readwrite", {
          durability: "strict",
        });
      } catch {
        db.close();
        reject(new RunSubmissionStorageError("unavailable"));
        return;
      }
      let value: ManualRunSubmission | null = null;
      let failure: unknown = new RunSubmissionStorageError("unavailable");
      const fail = (error: unknown) => {
        failure = error;
        try {
          tx.abort();
        } catch {
          db.close();
          reject(error);
        }
      };
      const timer = setTimeout(() => fail(new RunSubmissionStorageError("unavailable")), 10_000);
      tx.oncomplete = () => {
        clearTimeout(timer);
        db.close();
        try {
          scope.assertCurrent();
          resolve(value);
        } catch (error) {
          reject(error);
        }
      };
      tx.onabort = () => {
        clearTimeout(timer);
        db.close();
        reject(failure);
      };
      tx.onerror = () => {
        failure = new RunSubmissionStorageError("unavailable");
      };
      const store = tx.objectStore("pending");
      const reading = store.get(scope.ownerId);
      reading.onsuccess = () => {
        try {
          scope.assertCurrent();
          if (reading.result !== undefined) {
            const parsed = ManualRunSubmissionSchema.safeParse(reading.result);
            if (!parsed.success || parsed.data.ownerId !== scope.ownerId)
              throw new RunSubmissionStorageError("invalid");
            value = parsed.data;
          }
          if (mode === "begin") {
            if (!request || request.ownerId !== scope.ownerId)
              throw new RunSubmissionStorageError("invalid");
            // A native readwrite transaction serializes competing tabs. Never
            // overwrite an unresolved request with a new ID or new measurements.
            if (value) throw new RunSubmissionStorageError("pending_exists");
            store.add(request);
            value = request;
          } else if (mode === "ack") {
            if (
              !request ||
              request.ownerId !== scope.ownerId ||
              (value && value.requestId !== request.requestId)
            )
              throw new RunSubmissionStorageError("pending_exists");
            if (value) store.delete(scope.ownerId);
            value = null;
          }
        } catch (error) {
          fail(error);
        }
      };
    });
  }
  return {
    read: (scope: OfflineIdentityScope) => transaction(scope, "read"),
    begin: (scope: OfflineIdentityScope, input: unknown) =>
      transaction(scope, "begin", ManualRunSubmissionSchema.parse(input)),
    acknowledge: (scope: OfflineIdentityScope, input: unknown) =>
      transaction(scope, "ack", ManualRunSubmissionSchema.parse(input)),
  };
}
export const runSubmissionStore = createRunSubmissionStore();
