import { afterEach, describe, expect, it, vi } from "vitest";
import { createOfflineIdentity } from "./offline-identity";
import { readLegacyOffline, legacyOfflineDigest } from "./offline-legacy";
import {
  OfflineQueueError,
  OfflinePayloadSchema,
  syncPayload,
  validOfflineAcknowledgement,
  sameOfflineExecution,
  type OwnedOfflineItem,
  type OfflineSyncRequest,
} from "./offline-contract";
import {
  synchronizeOwnedOffline,
  recoverVerifiedLegacy,
  type OfflineRepository,
} from "./offline-sync.engine";
const A = "11111111-1111-4111-8111-111111111111",
  B = "22222222-2222-4222-8222-222222222222",
  SESSION = "33333333-3333-4333-8333-333333333333";
const ID = "44444444-4444-4444-8444-444444444444",
  AT = "2026-09-09T14:00:00.000Z";
const item = (n = 1, ownerId = A): OwnedOfflineItem => ({
  id: ID.slice(0, -2) + String(n).padStart(2, "0"),
  version: 3,
  ownerId,
  type: "workout_set",
  timestamp: Date.parse(AT),
  data: {
    sessionId: SESSION,
    exerciseSlug: "squat",
    exerciseName: "Synthetic squat",
    setNumber: n,
    reps: 8,
    weightKg: 20,
    rpe: null,
    done: true,
    performedAt: AT,
  },
});
const ack = (input: OfflineSyncRequest) => ({
  status: "acknowledged" as const,
  ownerId: input.ownerId,
  clientId: input.clientId,
  data: input.data,
  serverSetId: "55555555-5555-4555-8555-555555555555",
});
const request = (row: OwnedOfflineItem): OfflineSyncRequest => ({
  ownerId: row.ownerId,
  clientId: row.id,
  data: syncPayload(row),
});
function repository(initial: OwnedOfflineItem[]) {
  const rows = structuredClone(initial),
    imports = new Set<string>();
  const repo: OfflineRepository = {
    read: vi.fn(async (scope) => {
      scope.assertCurrent();
      return {
        ownerId: scope.ownerId,
        items: structuredClone(rows.filter((r) => r.ownerId === scope.ownerId)),
        invalidCount: 0,
      };
    }),
    add: vi.fn(async (scope, data, opts) => {
      scope.assertCurrent();
      if (opts?.legacy && imports.has(opts.legacy.digest)) return null;
      const next = { ...item(rows.length + 1, scope.ownerId), data };
      rows.push(next);
      if (opts?.legacy) imports.add(opts.legacy.digest);
      return next;
    }),
    acknowledge: vi.fn(async (scope, row, response) => {
      scope.assertCurrent();
      if (!validOfflineAcknowledgement(row, response)) return false;
      const index = rows.findIndex(
        (r) =>
          r.ownerId === scope.ownerId &&
          r.id === row.id &&
          sameOfflineExecution(syncPayload(r), syncPayload(row)),
      );
      if (index < 0) return false;
      rows.splice(index, 1);
      return true;
    }),
    retain: vi.fn(async (scope, row, reason) => {
      scope.assertCurrent();
      const current = rows.find((r) => r.ownerId === scope.ownerId && r.id === row.id);
      if (current) current.lastFailure = reason;
    }),
  };
  return { repo, rows };
}
function identity() {
  const auth = createOfflineIdentity();
  auth.set(A);
  return { auth, scope: auth.capture(A) };
}
afterEach(() => vi.useRealTimers());
describe("offline identity epochs", () => {
  it("requires a known signed-in owner before reading or saving", () => {
    const auth = createOfflineIdentity();
    expect(() => auth.capture(A)).toThrow("OFFLINE_IDENTITY_CHANGED");
    auth.set(A);
    expect(() => auth.capture(B)).toThrow();
  });
  it("invalidates old work even if A signs out and back in before it settles", () => {
    const { auth, scope } = identity();
    auth.set(null);
    auth.set(B);
    auth.set(A);
    expect(scope.isCurrent()).toBe(false);
    expect(auth.capture(A).isCurrent()).toBe(true);
  });
  it("a token refresh for the same identity does not discard its work", () => {
    const { auth, scope } = identity();
    auth.set(A);
    expect(scope.isCurrent()).toBe(true);
  });
});
describe("non-destructive earlier-version records", () => {
  const legacy = (rows: unknown) => ({
    getItem: vi.fn((key: string) => (key.endsWith(".unreadable") ? null : JSON.stringify(rows))),
  });
  it("reads empty, corrupt and unavailable storage as distinct states", () => {
    expect(readLegacyOffline({ getItem: () => null }).status).toBe("absent");
    expect(readLegacyOffline({ getItem: () => "not-json" })).toMatchObject({
      status: "present",
      items: [],
      invalidCount: 2,
    });
    expect(
      readLegacyOffline({
        getItem: () => {
          throw new Error("denied");
        },
      }).status,
    ).toBe("unavailable");
  });
  it("preserves good rows beside a malformed row, without rewriting either", () => {
    const data = legacy([item(), { broken: true }, item(2)]);
    const result = readLegacyOffline(data);
    expect(result.items).toHaveLength(2);
    expect(result.invalidCount).toBe(1);
    expect(data).not.toHaveProperty("setItem");
  });
  it("does not salvage by overwriting the old unreadable backup", () => {
    const raw = {
      getItem: (key: string) =>
        key.endsWith(".unreadable") ? JSON.stringify([item(2)]) : "broken",
    };
    const result = readLegacyOffline(raw);
    expect(result.items).toHaveLength(1);
    expect(result.invalidCount).toBe(1);
  });
  it("reads only bounded legacy input and marks truncation instead of claiming full recovery", () => {
    const report = readLegacyOffline(
      legacy(Array.from({ length: 201 }, (_, i) => ({ ...item(), id: String(i) }))),
    );
    expect(report.items).toHaveLength(200);
    expect(report.limited).toBe(true);
    expect(readLegacyOffline({ getItem: () => "x".repeat(2_000_001) }).limited).toBe(true);
  });
  it("retains the original performed time for old rows without a time field", () => {
    const row = item();
    delete row.data.performedAt;
    expect(syncPayload(row).performedAt).toBe(AT);
    expect(() => syncPayload({ ...row, timestamp: Infinity })).toThrow();
  });
  it("does not infer or coerce corrupted numeric facts", () => {
    expect(
      OfflinePayloadSchema.safeParse({ ...item(), data: { ...item().data, weightKg: "20" } })
        .success,
    ).toBe(false);
    expect(OfflinePayloadSchema.safeParse({ ...item(), timestamp: 9e20 }).success).toBe(false);
  });
  it("legacy fingerprint binds the values as well as their reused row ID", async () => {
    const one = item(),
      two = { ...one, data: { ...one.data, reps: 12 } };
    expect(await legacyOfflineDigest(one)).not.toBe(await legacyOfflineDigest(two));
  });
});
describe("acknowledged-only identity-bound outbox delivery", () => {
  it("reads/sends/removes only A records while preserving B byte-for-byte", async () => {
    const { scope } = identity(),
      db = repository([item(), item(2, B)]),
      before = JSON.stringify(db.rows[1]);
    const send = vi.fn(async (input) => ack(input));
    const result = await synchronizeOwnedOffline(scope, db.repo, send);
    expect(result).toMatchObject({ synced: 1, remaining: 0, cancelled: false });
    expect(send).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(db.rows[0])).toBe(before);
  });
  it.each([
    undefined,
    null,
    { ok: true },
    { status: "acknowledged" },
    { ...ack(request(item())), ownerId: B },
    { ...ack(request(item())), clientId: item(2).id },
    { ...ack(request(item())), data: { ...item().data, reps: 9 } },
  ])(
    "never treats an empty, wrong-owner or conflicting response as saved: %j",
    async (response) => {
      const { scope } = identity(),
        db = repository([item()]);
      const report = await synchronizeOwnedOffline(scope, db.repo, async () => response);
      expect(report.synced).toBe(0);
      expect(db.rows).toHaveLength(1);
      expect(db.repo.acknowledge).not.toHaveBeenCalled();
    },
  );
  it("retains explicit server conflicts and completed-session refusals", async () => {
    const { scope } = identity(),
      db = repository([item()]);
    await synchronizeOwnedOffline(scope, db.repo, async (input) => ({
      status: "retained",
      ownerId: A,
      clientId: input.clientId,
      reason: "conflict",
    }));
    expect(db.rows[0]!.lastFailure).toBe("conflict");
    expect(db.rows[0]!.data.weightKg).toBe(20);
  });
  it("does not delete or send the next A record after account B takes over mid-request", async () => {
    const { auth, scope } = identity(),
      db = repository([item(), item(2), item(3, B)]);
    const send = vi.fn(async (input) => {
      auth.set(B);
      return ack(input);
    });
    const report = await synchronizeOwnedOffline(scope, db.repo, send);
    expect(report.cancelled).toBe(true);
    expect(db.rows).toHaveLength(3);
    expect(send).toHaveBeenCalledTimes(1);
    expect(db.repo.acknowledge).not.toHaveBeenCalled();
  });
  it("retains the old owner rows when a sign-out/sign-in epoch changes back to A", async () => {
    const { auth, scope } = identity(),
      db = repository([item()]);
    await synchronizeOwnedOffline(scope, db.repo, async (input) => {
      auth.set(null);
      auth.set(A);
      return ack(input);
    });
    expect(db.rows).toHaveLength(1);
  });
  it("preserves records appended while the earlier snapshot was in flight", async () => {
    const { scope } = identity(),
      db = repository([item()]);
    await synchronizeOwnedOffline(scope, db.repo, async (input) => {
      db.rows.push(item(2));
      return ack(input);
    });
    expect(db.rows.map((row) => row.data.setNumber)).toEqual([2]);
  });
  it("a failed local acknowledgement transaction is not counted as synchronization", async () => {
    const { scope } = identity(),
      db = repository([item()]);
    vi.mocked(db.repo.acknowledge).mockRejectedValue(new OfflineQueueError("storage_rejected"));
    const result = await synchronizeOwnedOffline(scope, db.repo, async (input) => ack(input));
    expect(result.synced).toBe(0);
    expect(db.rows).toHaveLength(1);
  });
  it("bounds a hung network request and ignores a late successful response", async () => {
    vi.useFakeTimers();
    const { scope } = identity(),
      db = repository([item()]);
    let resolve!: (value: unknown) => void;
    const pending = new Promise((r) => {
      resolve = r;
    });
    const sent = synchronizeOwnedOffline(scope, db.repo, () => pending);
    await vi.advanceTimersByTimeAsync(20_001);
    expect((await sent).synced).toBe(0);
    resolve(ack(request(item())));
    await Promise.resolve();
    expect(db.rows).toHaveLength(1);
    expect(db.repo.acknowledge).not.toHaveBeenCalled();
  });
  it("offline delivery makes no server call, and storage unavailability is not an empty queue", async () => {
    const { scope } = identity(),
      db = repository([item()]),
      send = vi.fn();
    expect((await synchronizeOwnedOffline(scope, db.repo, send, () => false)).remaining).toBe(1);
    expect(send).not.toHaveBeenCalled();
    vi.mocked(db.repo.read).mockRejectedValue(new OfflineQueueError("storage_unavailable"));
    await expect(synchronizeOwnedOffline(scope, db.repo, send)).rejects.toThrow(
      "OFFLINE_STORAGE_UNAVAILABLE",
    );
  });
});
describe("verified legacy adoption", () => {
  const view = {
    status: "present" as const,
    items: [
      item(),
      { ...item(2), data: { ...item(2).data, sessionId: "66666666-6666-4666-8666-666666666666" } },
    ],
    invalidCount: 1,
    limited: false,
  };
  it("imports only sessions verified for this account and keeps malformed/unowned records untouched", async () => {
    const before = JSON.stringify(view),
      { scope } = identity(),
      db = repository([]);
    const report = await recoverVerifiedLegacy(scope, view, db.repo, async (input) => ({
      ownerId: input.ownerId,
      sessionIds: [SESSION],
    }));
    expect(report).toMatchObject({ recovered: 1, unverified: 1, invalidCount: 1 });
    expect(JSON.stringify(view)).toBe(before);
    expect(db.rows[0]!.data.performedAt).toBe(AT);
  });
  it("a failed ownership read performs no import", async () => {
    const { scope } = identity(),
      db = repository([]);
    await expect(
      recoverVerifiedLegacy(scope, view, db.repo, async () => {
        throw new Error("unavailable");
      }),
    ).rejects.toThrow();
    expect(db.repo.add).not.toHaveBeenCalled();
  });
  it.each([
    { ownerId: B, sessionIds: [SESSION] },
    { ownerId: A, sessionIds: ["77777777-7777-4777-8777-777777777777"] },
  ])("refuses a mismatched or unsolicited verification response %j", async (response) => {
    const { scope } = identity(),
      db = repository([]);
    await expect(
      recoverVerifiedLegacy(scope, view, db.repo, async () => response),
    ).rejects.toThrow();
    expect(db.repo.add).not.toHaveBeenCalled();
  });
  it("does not reimport a row already accounted for in the atomic recovery ledger", async () => {
    const { scope } = identity(),
      db = repository([]),
      verify = async () => ({ ownerId: A, sessionIds: [SESSION] });
    expect((await recoverVerifiedLegacy(scope, view, db.repo, verify)).recovered).toBe(1);
    expect((await recoverVerifiedLegacy(scope, view, db.repo, verify)).recovered).toBe(0);
  });
  it("rejects verification completing after an identity change without adopting rows", async () => {
    const { auth, scope } = identity(),
      db = repository([]);
    await expect(
      recoverVerifiedLegacy(scope, view, db.repo, async () => {
        auth.set(B);
        return { ownerId: A, sessionIds: [SESSION] };
      }),
    ).rejects.toThrow("OFFLINE_IDENTITY_CHANGED");
    expect(db.repo.add).not.toHaveBeenCalled();
  });
});
