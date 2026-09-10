import {
  OfflineSyncReplySchema,
  validOfflineAcknowledgement,
  LegacyOwnershipReplySchema,
  OfflineQueueError,
  syncPayload,
  type OwnedQueueView,
  type OwnedOfflineItem,
  type OfflineSyncRequest,
  type OfflineSyncResult,
  type OfflineRetainedReason,
} from "./offline-contract";
import type { OfflineIdentityScope } from "./offline-identity";
import { legacyOfflineDigest, type LegacyOfflineView } from "./offline-legacy";
import type { createOfflineDatabase } from "./offline-database";
export type OfflineRepository = Pick<
  ReturnType<typeof createOfflineDatabase>,
  "read" | "add" | "acknowledge" | "retain"
>;
/** A network timeout never acknowledges the record; late replies cannot remove it. */
export async function boundedOfflineCall<T>(
  action: () => Promise<T>,
  milliseconds = 20_000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(action),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("OFFLINE_SYNC_UNAVAILABLE")), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
export async function synchronizeOwnedOffline(
  scope: OfflineIdentityScope,
  store: OfflineRepository,
  send: (input: OfflineSyncRequest) => Promise<unknown>,
  online: () => boolean = () => true,
): Promise<OfflineSyncResult> {
  scope.assertCurrent();
  const snapshot = await store.read(scope);
  let synced = 0;
  const deadline = Date.now() + 45_000;
  for (const item of snapshot.items) {
    if (!scope.isCurrent() || !online() || Date.now() >= deadline) break;
    try {
      scope.assertCurrent();
      const response = await boundedOfflineCall(
        () => {
          scope.assertCurrent();
          return send({ ownerId: scope.ownerId, clientId: item.id, data: syncPayload(item) });
        },
        Math.max(1, Math.min(20_000, deadline - Date.now())),
      );
      if (!scope.isCurrent()) break;
      const parsed = OfflineSyncReplySchema.safeParse(response);
      if (
        parsed.success &&
        parsed.data.status === "acknowledged" &&
        validOfflineAcknowledgement(item, parsed.data)
      ) {
        if (await store.acknowledge(scope, item, parsed.data)) synced++;
        else await store.retain(scope, item, "conflict");
      } else {
        const reason =
          parsed.success &&
          parsed.data.ownerId === scope.ownerId &&
          parsed.data.clientId === item.id &&
          parsed.data.status === "retained"
            ? parsed.data.reason
            : "unavailable";
        await store.retain(scope, item, reason);
      }
    } catch {
      if (!scope.isCurrent()) break;
      // Unavailable transport/storage is not a positive acknowledgement.
      try {
        await store.retain(scope, item, "unavailable");
      } catch {
        break;
      }
      if (!online()) break;
    }
  }
  if (!scope.isCurrent())
    return {
      ownerId: scope.ownerId,
      synced,
      remaining: snapshot.items.length - synced,
      invalidCount: snapshot.invalidCount,
      cancelled: true,
    };
  const remaining = await store.read(scope);
  return {
    ownerId: scope.ownerId,
    synced,
    remaining: remaining.items.length,
    invalidCount: remaining.invalidCount,
    cancelled: false,
  };
}
export type LegacyRecoveryResult = {
  ownerId: string;
  recovered: number;
  unverified: number;
  invalidCount: number;
  limited: boolean;
};
/** Explicit recovery checks the authenticated owner before importing any old measurement. */
export async function recoverVerifiedLegacy(
  scope: OfflineIdentityScope,
  legacy: LegacyOfflineView,
  store: OfflineRepository,
  verify: (input: { ownerId: string; sessionIds: string[] }) => Promise<unknown>,
): Promise<LegacyRecoveryResult> {
  scope.assertCurrent();
  if (legacy.status === "unavailable") throw new OfflineQueueError("storage_unavailable");
  const result: LegacyRecoveryResult = {
    ownerId: scope.ownerId,
    recovered: 0,
    unverified: 0,
    invalidCount: legacy.invalidCount,
    limited: legacy.limited,
  };
  if (!legacy.items.length) return result;
  const requested = [...new Set(legacy.items.map((item) => item.data.sessionId))];
  const raw = await boundedOfflineCall(() => {
    scope.assertCurrent();
    return verify({ ownerId: scope.ownerId, sessionIds: requested });
  });
  scope.assertCurrent();
  const response = LegacyOwnershipReplySchema.parse(raw);
  if (
    response.ownerId !== scope.ownerId ||
    response.sessionIds.some((id) => !requested.includes(id))
  )
    throw new OfflineQueueError("identity_changed");
  const owned = new Set(response.sessionIds);
  for (const item of legacy.items) {
    scope.assertCurrent();
    if (!owned.has(item.data.sessionId)) {
      result.unverified++;
      continue;
    }
    const digest = await legacyOfflineDigest(item);
    scope.assertCurrent();
    if (await store.add(scope, syncPayload(item), { legacy: { source: item, digest } }))
      result.recovered++;
  }
  return result;
}
