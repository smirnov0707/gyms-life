import { OwnerIdSchema, OfflineQueueError } from "./offline-contract";
export type OfflineIdentityScope = {
  ownerId: string;
  isCurrent: () => boolean;
  assertCurrent: () => void;
  epoch: number;
};
/** Identity epochs are process-local, never bearer tokens or persisted auth state. */
export function createOfflineIdentity() {
  let owner: string | null = null,
    epoch = 0;
  return {
    set(next: string | null) {
      if (next !== null) OwnerIdSchema.parse(next);
      if (next !== owner) {
        owner = next;
        epoch++;
      }
    },
    current() {
      return owner;
    },
    capture(expected: string): OfflineIdentityScope {
      OwnerIdSchema.parse(expected);
      if (owner !== expected) throw new OfflineQueueError("identity_changed");
      const captured = epoch,
        isCurrent = () => owner === expected && epoch === captured;
      return {
        ownerId: expected,
        epoch: captured,
        isCurrent,
        assertCurrent() {
          if (!isCurrent()) throw new OfflineQueueError("identity_changed");
        },
      };
    },
  };
}
export const offlineIdentity = createOfflineIdentity();
