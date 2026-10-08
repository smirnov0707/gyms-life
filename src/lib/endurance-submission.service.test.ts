import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/integrations/supabase/types";
import { submitManualRun, manualRunSessionId } from "./endurance-submission.service";
import { ManualRunSubmissionSchema, acknowledgesManualRun } from "./endurance-submission.schema";

const enrichment = vi.hoisted(() => vi.fn());
vi.mock("./endurance-race-enrichment.service", () => ({
  retryEnduranceRaceEnrichment: enrichment,
  unavailableEnduranceEnrichment: () => ({
    raceMatch: null,
    raceIntelligence: null,
    raceEnrichment: { status: "unavailable", linked: false, retryable: true, stage: "load" },
  }),
}));
const A = "10000000-0000-4000-8000-000000000001";
const B = "10000000-0000-4000-8000-000000000002";
const request = ManualRunSubmissionSchema.parse({
  ownerId: A,
  requestId: "20000000-0000-4000-8000-000000000002",
  activity: {
    kind: "run",
    source: "manual",
    environment: "treadmill",
    startedAt: "2026-10-07T22:30:00Z",
    durationSeconds: 1800,
    distanceMeters: 5000,
    perceivedEffort: 4,
  },
});
type Row = Record<string, unknown>;
/** Real supabase-js HTTP construction; scripted persistence, not live SQL/RLS. */
function database() {
  const rows = new Map<string, Row>();
  const calls: { method: string; url: URL; body: Row | null }[] = [];
  const faults = {
    loseInsertReply: false,
    failReads: false,
    failInsert: false,
    failReadAfterInsert: false,
  };
  const respond = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "content-type": "application/json" },
    });
  const db = createClient<Database>("https://synthetic.invalid", "synthetic-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, options) => {
        const url = new URL(
          typeof input === "string" ? input : input instanceof URL ? input : input.url,
        );
        const method = options?.method ?? "GET";
        const body: Row | null =
          typeof options?.body === "string" ? JSON.parse(options.body) : null;
        calls.push({ method, url, body });
        expect(url.pathname).toBe("/rest/v1/workout_sessions");
        if (method === "GET") {
          if (faults.failReads)
            return respond({ code: "XX000", message: "Synthetic read failure" }, 400);
          const row = rows.get((url.searchParams.get("id") ?? "").replace(/^eq\./, ""));
          const owner = (url.searchParams.get("user_id") ?? "").replace(/^eq\./, "");
          return respond(row && row["user_id"] === owner ? [row] : []);
        }
        expect(method).toBe("POST");
        if (!body || typeof body["id"] !== "string") throw new Error("Unkeyed insert");
        if (faults.failInsert)
          return respond({ code: "42501", message: "Synthetic denied write" }, 403);
        if (rows.has(body["id"]))
          return respond({ code: "23505", message: "Synthetic primary-key conflict" }, 409);
        rows.set(body["id"], structuredClone(body));
        if (faults.failReadAfterInsert) faults.failReads = true;
        if (faults.loseInsertReply) throw new TypeError("Synthetic connection lost after commit");
        return respond(body, 201);
      },
    },
  });
  return { db, rows, calls, faults };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-08T06:00:00Z"));
  enrichment.mockReset().mockResolvedValue({
    raceMatch: null,
    raceIntelligence: null,
    raceEnrichment: { status: "no_active_plan", linked: false, retryable: false },
  });
});
afterEach(() => vi.useRealTimers());

describe("original manual-run request identity", () => {
  it("creates one keyed canonical run with original evidence and zero strength volume", async () => {
    const d = database();
    const result = await submitManualRun(d.db, A, request);
    expect(result.submission.persistence).toBe("created");
    expect(acknowledgesManualRun(request, result)).toBe(true);
    expect(result.session.id).toBe(manualRunSessionId(A, request.requestId));
    expect(d.rows.size).toBe(1);
    expect([...d.rows.values()][0]).toMatchObject({
      user_id: A,
      title: "Run",
      total_volume: 0,
      started_at: "2026-10-07T22:30:00.000Z",
      finished_at: "2026-10-07T23:00:00.000Z",
      workout_snapshot: {
        enduranceCredit: { status: "credited", durationMinutes: 30 },
        manualRunSubmission: { version: 1, requestId: request.requestId },
      },
    });
    for (const call of d.calls.filter((c) => c.method === "GET"))
      expect(call.url.searchParams.get("user_id")).toBe(`eq.${A}`);
    expect(d.calls.some((c) => c.url.searchParams.has("on_conflict"))).toBe(false);
  });
  it("replays an acknowledged request without another insert or snapshot mutation", async () => {
    const d = database();
    await submitManualRun(d.db, A, request);
    const before = JSON.stringify([...d.rows]);
    const replay = await submitManualRun(d.db, A, request);
    expect(replay.submission.persistence).toBe("replayed");
    expect(d.calls.filter((c) => c.method === "POST")).toHaveLength(1);
    expect(JSON.stringify([...d.rows])).toBe(before);
  });
  it("recovers a lost insert response by scoped readback", async () => {
    const d = database();
    d.faults.loseInsertReply = true;
    const result = await submitManualRun(d.db, A, request);
    expect(result.submission.persistence).toBe("replayed");
    expect(d.rows.size).toBe(1);
    expect(acknowledgesManualRun(request, result)).toBe(true);
  });
  it("retains uncertainty when response and readback are lost, then returns the same row", async () => {
    const d = database();
    d.faults.loseInsertReply = true;
    d.faults.failReadAfterInsert = true;
    await expect(submitManualRun(d.db, A, request)).rejects.toThrow(
      "RUN_SUBMISSION_READ_UNAVAILABLE",
    );
    expect(d.rows.size).toBe(1);
    d.faults.failReads = false;
    d.faults.loseInsertReply = false;
    const result = await submitManualRun(d.db, A, request);
    expect(result.submission.persistence).toBe("replayed");
    expect(d.calls.filter((c) => c.method === "POST")).toHaveLength(1);
  });
  it("two concurrent deliveries converge on one primary key", async () => {
    const d = database();
    const replies = await Promise.all([
      submitManualRun(d.db, A, request),
      submitManualRun(d.db, A, request),
    ]);
    expect(d.rows.size).toBe(1);
    expect(new Set(replies.map((r) => r.session.id)).size).toBe(1);
    expect(replies.map((r) => r.submission.persistence).sort()).toEqual(["created", "replayed"]);
  });
  it.each([
    { durationSeconds: 1900 },
    { distanceMeters: 5100 },
    { perceivedEffort: 5 },
    { environment: "outdoor" },
    { startedAt: "2026-10-07T22:31:00Z" },
    { averageHeartRateBpm: 140 },
  ])("rejects changed evidence under the same key: %j", async (change) => {
    const d = database();
    await submitManualRun(d.db, A, request);
    await expect(
      submitManualRun(d.db, A, { ...request, activity: { ...request.activity, ...change } }),
    ).rejects.toThrow("RUN_SUBMISSION_CONFLICT");
    expect(d.rows.size).toBe(1);
    expect(d.calls.filter((c) => c.method === "POST")).toHaveLength(1);
  });
  it("normalizes date offsets without changing a request's meaning", async () => {
    const d = database();
    const a = await submitManualRun(d.db, A, request);
    const b = await submitManualRun(d.db, A, {
      ...request,
      activity: { ...request.activity, startedAt: "2026-10-08T01:30:00+03:00" },
    });
    expect(a.session.id).toBe(b.session.id);
    expect(b.submission.persistence).toBe("replayed");
  });
  it("binds the owner before any query even when a browser sends an old account's request", async () => {
    const d = database();
    await expect(submitManualRun(d.db, B, request)).rejects.toThrow("RUN_SUBMISSION_OWNER_CHANGED");
    expect(d.calls).toEqual([]);
    expect(enrichment).not.toHaveBeenCalled();
  });
  it("scopes a reused client UUID to different owners", async () => {
    const d = database();
    const first = await submitManualRun(d.db, A, request);
    const second = await submitManualRun(d.db, B, { ...request, ownerId: B });
    expect(first.session.id).not.toBe(second.session.id);
    expect(d.rows.size).toBe(2);
  });
  it("does not interpret unreadable existing records as permission to insert", async () => {
    const d = database();
    d.faults.failReads = true;
    await expect(submitManualRun(d.db, A, request)).rejects.toThrow(
      "RUN_SUBMISSION_READ_UNAVAILABLE",
    );
    expect(d.calls.some((c) => c.method === "POST")).toBe(false);
  });
  it("does not acknowledge a denied insert with no saved row", async () => {
    const d = database();
    d.faults.failInsert = true;
    await expect(submitManualRun(d.db, A, request)).rejects.toThrow("RUN_SUBMISSION_UNCONFIRMED");
    expect(d.rows.size).toBe(0);
  });
  it("does not recreate a different legacy row at the same ID", async () => {
    const d = database();
    d.rows.set(manualRunSessionId(A, request.requestId), {
      id: manualRunSessionId(A, request.requestId),
      user_id: A,
    });
    await expect(submitManualRun(d.db, A, request)).rejects.toThrow("RUN_SUBMISSION_CONFLICT");
    expect(d.calls.some((c) => c.method === "POST")).toBe(false);
  });
  it("does not overwrite a saved run later changed by another operation", async () => {
    const d = database();
    const first = await submitManualRun(d.db, A, request);
    const row = d.rows.get(first.session.id);
    if (!row) throw new Error("Missing test row");
    row["distance_meters"] = 9000;
    await expect(submitManualRun(d.db, A, request)).rejects.toThrow("RUN_SUBMISSION_CONFLICT");
    expect(row["distance_meters"]).toBe(9000);
  });
  it("preserves primary acknowledgment when plan enrichment throws", async () => {
    const d = database();
    enrichment.mockRejectedValue(new Error("Synthetic unavailable"));
    const result = await submitManualRun(d.db, A, request);
    expect(result.raceEnrichment.status).toBe("unavailable");
    expect(acknowledgesManualRun(request, result)).toBe(true);
  });
  it("rejects completed activity in the future without writing", async () => {
    const d = database();
    await expect(
      submitManualRun(d.db, A, {
        ...request,
        activity: { ...request.activity, startedAt: "2026-10-09T00:00:00Z" },
      }),
    ).rejects.toThrow("RUN_SUBMISSION_IN_FUTURE");
    expect(d.rows.size).toBe(0);
  });
  it.each([
    { ...request, requestId: "not-a-uuid" },
    { ...request, extra: true },
    { ...request, activity: { ...request.activity, source: "wearable" } },
    { ...request, activity: { ...request.activity, kind: "walk" } },
  ])("rejects invalid or untrusted source claims before reads", async (value) => {
    const d = database();
    await expect(submitManualRun(d.db, A, value)).rejects.toThrow();
    expect(d.calls).toEqual([]);
  });
  it("does not erase the client journal for mismatched receipts or evidence", async () => {
    const d = database();
    const result = await submitManualRun(d.db, A, request);
    for (const bad of [
      null,
      {},
      { ...result, submission: { ...result.submission, ownerId: B } },
      { ...result, submission: { ...result.submission, requestId: B } },
      { ...result, activity: { ...result.activity, distanceMeters: 10000 } },
      { ...result, session: { ...result.session, finished_at: result.session.started_at } },
    ])
      expect(acknowledgesManualRun(request, bad)).toBe(false);
  });
});
