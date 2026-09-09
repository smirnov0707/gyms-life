import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
const mocked = vi.hoisted(() => ({ write: vi.fn() }));
vi.mock("./set-log.service", () => ({ recordOwnedWorkoutSet: mocked.write }));
import { synchronizeOfflineForOwner, resolveLegacyOfflineOwnership } from "./offline-sync.server";
const A = "11111111-1111-4111-8111-111111111111",
  B = "22222222-2222-4222-8222-222222222222",
  SESSION = "33333333-3333-4333-8333-333333333333",
  CLIENT = "44444444-4444-4444-8444-444444444444",
  SET = "55555555-5555-4555-8555-555555555555";
const now = new Date("2026-09-09T15:00:00Z"),
  data = {
    sessionId: SESSION,
    exerciseSlug: "squat",
    exerciseName: "Synthetic squat",
    setNumber: 1,
    reps: 8,
    weightKg: 20,
    rpe: null,
    done: true,
    performedAt: "2026-09-09T14:00:00Z",
  };
const request = { ownerId: A, clientId: CLIENT, data };
const stored = {
  id: SET,
  user_id: A,
  session_id: SESSION,
  exercise_slug: "squat",
  set_number: 1,
  reps: 8,
  weight_kg: 20,
  rpe: null,
  done: true,
  performed_at: data.performedAt,
  created_at: "2026-09-09T14:05:00Z",
};
function database(responses: Array<{ data: unknown; error: unknown }>) {
  const calls: { table: string; queries: Array<[string, unknown[]]> }[] = [];
  const from = vi.fn((table: string) => {
    const ops = { table, queries: [] as Array<[string, unknown[]]> };
    calls.push(ops);
    if (!responses.length) throw new Error("Unexpected query");
    const response = Promise.resolve(responses.shift());
    const query = new Proxy(
      {},
      {
        get: (_t, key) =>
          key === "then"
            ? response.then.bind(response)
            : (...args: unknown[]) => {
                ops.queries.push([String(key), args]);
                return query;
              },
      },
    );
    return query;
  });
  return { client: { from } as unknown as SupabaseClient<Database>, calls, from };
}
const ok = (data: unknown) => ({ data, error: null });
beforeEach(() => {
  mocked.write.mockReset().mockResolvedValue({ ok: true });
});
describe("offline server owner and exact acknowledgement", () => {
  it("a stale A request carrying a current B token cannot touch the database", async () => {
    const db = database([]);
    await expect(synchronizeOfflineForOwner(db.client, B, request, now)).rejects.toThrow(
      "OFFLINE_IDENTITY_CHANGED",
    );
    expect(db.from).not.toHaveBeenCalled();
    expect(mocked.write).not.toHaveBeenCalled();
  });
  it("acknowledges exact existing execution values, including a lost response after finish", async () => {
    const db = database([ok(stored)]);
    expect(await synchronizeOfflineForOwner(db.client, A, request, now)).toMatchObject({
      status: "acknowledged",
      ownerId: A,
      clientId: CLIENT,
      serverSetId: SET,
    });
    expect(mocked.write).not.toHaveBeenCalled();
    expect(db.calls[0]!.queries).toContainEqual(["eq", ["user_id", A]]);
  });
  it.each([
    { reps: 9 },
    { weight_kg: 25 },
    { rpe: 6 },
    { done: false },
    { performed_at: "2026-09-09T14:01:00Z" },
    { exercise_slug: "other" },
  ])(
    "keeps a conflicting server record and does not acknowledge a different local version %j",
    async (changed) => {
      const db = database([ok({ ...stored, ...changed })]);
      expect(await synchronizeOfflineForOwner(db.client, A, request, now)).toMatchObject({
        status: "retained",
        reason: "conflict",
      });
      expect(mocked.write).not.toHaveBeenCalled();
    },
  );
  it("new rows use the ordinary plan-checked service and a separate confirmed owner-scoped read", async () => {
    const db = database([ok(null), ok({ id: SESSION, finished_at: null }), ok(stored)]);
    expect((await synchronizeOfflineForOwner(db.client, A, request, now)).status).toBe(
      "acknowledged",
    );
    expect(mocked.write).toHaveBeenCalledWith(db.client, A, data);
    for (const query of db.calls) expect(query.queries).toContainEqual(["eq", ["user_id", A]]);
  });
  it("does not equate a successful transport to a saved row", async () => {
    const db = database([ok(null), ok({ id: SESSION, finished_at: null }), ok(null)]);
    await expect(synchronizeOfflineForOwner(db.client, A, request, now)).rejects.toThrow(
      "OFFLINE_SYNC_UNCONFIRMED",
    );
  });
  it("a competing tab's different unique set is retained rather than overwritten", async () => {
    const db = database([
      ok(null),
      ok({ id: SESSION, finished_at: null }),
      ok({ ...stored, reps: 12 }),
    ]);
    expect(await synchronizeOfflineForOwner(db.client, A, request, now)).toMatchObject({
      status: "retained",
      reason: "conflict",
    });
  });
  it.each([
    [null, "session_unavailable"],
    [{ id: SESSION, finished_at: "2026-09-09T14:30:00Z" }, "session_finished"],
  ])("does not create a new row for unavailable/finished session %j", async (session, reason) => {
    const db = database([ok(null), ok(session)]);
    expect(await synchronizeOfflineForOwner(db.client, A, request, now)).toMatchObject({
      status: "retained",
      reason,
    });
    expect(mocked.write).not.toHaveBeenCalled();
  });
  it("retains an old performed time for review instead of silently redating it", async () => {
    const db = database([ok(null), ok({ id: SESSION, finished_at: null })]);
    expect(
      await synchronizeOfflineForOwner(
        db.client,
        A,
        { ...request, data: { ...data, performedAt: "2025-09-09T14:00:00Z" } },
        now,
      ),
    ).toMatchObject({ status: "retained", reason: "performed_at_review" });
    expect(mocked.write).not.toHaveBeenCalled();
  });
  it("a read error cannot become session-not-found success", async () => {
    const db = database([{ data: null, error: { message: "private database detail" } }]);
    await expect(synchronizeOfflineForOwner(db.client, A, request, now)).rejects.toThrow(
      "OFFLINE_SYNC_UNAVAILABLE",
    );
  });
});
describe("legacy authenticated ownership lookup", () => {
  it("uses only session IDs, scoped to the verified account", async () => {
    const db = database([ok([{ id: SESSION }])]);
    expect(
      await resolveLegacyOfflineOwnership(db.client, A, { ownerId: A, sessionIds: [SESSION] }),
    ).toEqual({ ownerId: A, sessionIds: [SESSION] });
    expect(db.calls[0]!.queries).toContainEqual(["eq", ["user_id", A]]);
    expect(db.calls[0]!.queries).toContainEqual(["select", ["id"]]);
  });
  it("denies stale expected owner before query", async () => {
    const db = database([]);
    await expect(
      resolveLegacyOfflineOwnership(db.client, B, { ownerId: A, sessionIds: [SESSION] }),
    ).rejects.toThrow("OFFLINE_IDENTITY_CHANGED");
    expect(db.from).not.toHaveBeenCalled();
  });
  it("does not invent ownership after an unavailable query", async () => {
    const db = database([{ data: null, error: { message: "offline" } }]);
    await expect(
      resolveLegacyOfflineOwnership(db.client, A, { ownerId: A, sessionIds: [SESSION] }),
    ).rejects.toThrow("OFFLINE_OWNERSHIP_UNAVAILABLE");
  });
});
