import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "@/integrations/supabase/types";
import { persistEnduranceActivity } from "./endurance-submission.service";
import { buildEnduranceTrainingCredit } from "./endurance-training-credit.engine";
import {
  ManualEnduranceSubmissionSchema,
  isManualEnduranceAcknowledgement,
  sameEnduranceActivity,
} from "./endurance-submission.schema";
import type { EnduranceActivity } from "./endurance-activity.schema";

const OWNER = "10000000-0000-4000-8000-000000000001";
const ID = "20000000-0000-4000-8000-000000000002";
const OTHER = "30000000-0000-4000-8000-000000000003";
const activity: EnduranceActivity = {
  kind: "run",
  environment: "outdoor",
  source: "manual",
  startedAt: "2026-10-07T21:30:00.000Z",
  durationSeconds: 1800,
  distanceMeters: 5000,
  averageHeartRateBpm: null,
  perceivedEffort: 4,
};
const finish = "2026-10-07T22:00:00.000Z";
const credit = buildEnduranceTrainingCredit(activity);
const submission = ManualEnduranceSubmissionSchema.parse({
  ownerId: OWNER,
  submissionId: ID,
  activity,
});
const row = {
  id: ID,
  activity_kind: activity.kind,
  activity_environment: activity.environment,
  activity_source: activity.source,
  duration_seconds: activity.durationSeconds,
  distance_meters: activity.distanceMeters,
  average_heart_rate_bpm: activity.averageHeartRateBpm,
  perceived_effort: activity.perceivedEffort,
  user_id: OWNER,
  started_at: activity.startedAt,
  finished_at: finish,
  workout_snapshot: { enduranceCredit: credit, manualSubmission: { version: 1, ...submission } },
};
type Call = { method: string; url: URL; body: Record<string, unknown> | null };
function client(handler: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const db = createClient<Database>("https://synthetic.invalid", "synthetic-anon-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: async (input, init) => {
        const call = {
          method: init?.method ?? "GET",
          url: new URL(String(input)),
          body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
        };
        calls.push(call);
        return handler(call);
      },
    },
  });
  return { db, calls };
}
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
function scripted(...responses: Response[]) {
  return client(() => {
    const next = responses.shift();
    if (!next) throw new Error("Unscripted request");
    return next;
  });
}
const duplicate = () => response({ code: "23505", message: "synthetic unique conflict" }, 409);
const save = (db: ReturnType<typeof client>["db"], input = activity, id: string | undefined = ID) =>
  persistEnduranceActivity(db, OWNER, input, buildEnduranceTrainingCredit(input), finish, id);

describe("manual save identity at the real supabase-js HTTP boundary", () => {
  it("stores one initial run with stable ID and an immutable receipt marker", async () => {
    const c = scripted(
      response([]),
      response({ id: ID, started_at: activity.startedAt, finished_at: finish }, 201),
    );
    const result = await save(c.db);
    expect(result.manualSubmission).toEqual({
      ownerId: OWNER,
      submissionId: ID,
      disposition: "created",
    });
    expect(c.calls.map((c) => c.method)).toEqual(["GET", "POST"]);
    expect(c.calls.at(0)?.url.searchParams.get("user_id")).toBe(`eq.${OWNER}`);
    expect(c.calls.at(0)?.url.searchParams.get("id")).toBe(`eq.${ID}`);
    expect(c.calls.at(1)?.body).toMatchObject({
      id: ID,
      user_id: OWNER,
      workout_snapshot: row.workout_snapshot,
    });
    expect(c.calls.some((c) => c.method === "PATCH")).toBe(false);
  });
  it("replays the saved request without a second insert", async () => {
    const c = scripted(response([row]));
    const result = await save(c.db);
    expect(result.manualSubmission?.disposition).toBe("replayed");
    expect(result.session.id).toBe(ID);
    expect(c.calls).toHaveLength(1);
  });
  it("recovers a lost first response with the same stable ID", async () => {
    let persisted = false,
      inserts = 0;
    const c = client((call) => {
      if (call.method === "GET") return response(persisted ? [row] : []);
      inserts++;
      persisted = true;
      return response({ message: "Synthetic response loss after commit", code: "TRANSPORT" }, 503);
    });
    await expect(save(c.db)).rejects.toMatchObject({ code: "TRANSPORT" });
    expect((await save(c.db)).manualSubmission?.disposition).toBe("replayed");
    expect(inserts).toBe(1);
  });
  it("reads the winning row after a racing primary-key conflict", async () => {
    const c = scripted(response([]), duplicate(), response([row]));
    expect((await save(c.db)).manualSubmission?.disposition).toBe("replayed");
    expect(c.calls.map((c) => c.method)).toEqual(["GET", "POST", "GET"]);
  });
  it("does not reinterpret an unrelated uniqueness failure as acknowledgement", async () => {
    const c = scripted(response([]), duplicate(), response([]));
    await expect(save(c.db)).rejects.toThrow("ENDURANCE_SUBMISSION_CONFLICT");
  });
  it("does not insert after a failed ownership-scoped read", async () => {
    const c = scripted(response({ code: "42501", message: "synthetic forbidden" }, 403));
    await expect(save(c.db)).rejects.toThrow("ENDURANCE_SUBMISSION_UNAVAILABLE");
    expect(c.calls.map((c) => c.method)).toEqual(["GET"]);
  });
  it.each([
    { distanceMeters: 6000 },
    { durationSeconds: 1900 },
    { perceivedEffort: 5 },
    { averageHeartRateBpm: 120 },
    { environment: "treadmill" },
    { startedAt: "2026-10-07T21:31:00.000Z" },
    { kind: "walk" },
  ])("rejects changed evidence under the same ID: %j", async (patch) => {
    const changed = ManualEnduranceSubmissionSchema.shape.activity.parse({ ...activity, ...patch });
    const c = scripted(response([row]));
    await expect(save(c.db, changed)).rejects.toThrow("ENDURANCE_SUBMISSION_CONFLICT");
    expect(c.calls).toHaveLength(1);
  });
  it.each([
    { duration_seconds: 99 },
    { distance_meters: 9000 },
    { activity_kind: "walk" },
    { activity_source: "device" },
    { perceived_effort: 8 },
    { workout_snapshot: null },
    { workout_snapshot: { enduranceCredit: credit } },
    { finished_at: null },
    { user_id: OTHER },
    { id: OTHER },
    { started_at: "2026-10-07T20:30:00.000Z" },
  ])("does not acknowledge an unrelated or invalid row: %j", async (patch) => {
    const c = scripted(response([{ ...row, ...patch }]));
    await expect(save(c.db)).rejects.toThrow("ENDURANCE_SUBMISSION_CONFLICT");
  });
  it("uses timestamp semantics rather than the UTC-offset spelling", async () => {
    const c = scripted(
      response([
        {
          ...row,
          started_at: "2026-10-08T00:30:00+03:00",
          finished_at: "2026-10-08T01:00:00+03:00",
        },
      ]),
    );
    expect((await save(c.db)).manualSubmission?.disposition).toBe("replayed");
  });
  it("never mutates an already linked session on replay", async () => {
    const c = scripted(
      response([
        { ...row, endurance_match_source: "user_confirmed", endurance_plan_session_key: "w1-s1" },
      ]),
    );
    await save(c.db);
    expect(c.calls.map((c) => c.method)).toEqual(["GET"]);
  });
  it("keeps the legacy unkeyed save path compatible", async () => {
    const c = scripted(
      response({ id: ID, started_at: activity.startedAt, finished_at: finish }, 201),
    );
    const result = await persistEnduranceActivity(c.db, OWNER, activity, credit, finish);
    expect(result.manualSubmission).toBeNull();
    expect(c.calls.map((c) => c.method)).toEqual(["POST"]);
    expect(c.calls.at(0)?.body).not.toHaveProperty("id");
    expect(c.calls.at(0)?.body?.["workout_snapshot"]).toEqual({ enduranceCredit: credit });
  });
  it("rejects invalid request identity before network access", async () => {
    const c = scripted();
    await expect(save(c.db, activity, "invalid")).rejects.toThrow();
    expect(c.calls).toEqual([]);
  });
  it("does not support forged device provenance on a manual idempotent path", async () => {
    const c = scripted();
    await expect(save(c.db, { ...activity, source: "device" })).rejects.toThrow();
    expect(c.calls).toEqual([]);
  });
});

describe("acknowledgement identity", () => {
  const reply = {
    session: { id: ID },
    activity,
    manualSubmission: { ownerId: OWNER, submissionId: ID, disposition: "replayed" },
  };
  it("accepts the matching owner, request, session and execution", () =>
    expect(isManualEnduranceAcknowledgement(submission, reply)).toBe(true));
  it.each([
    { ...reply, session: { id: OTHER } },
    { ...reply, manualSubmission: { ...reply.manualSubmission, ownerId: OTHER } },
    { ...reply, manualSubmission: { ...reply.manualSubmission, submissionId: OTHER } },
    { ...reply, activity: { ...activity, distanceMeters: 9000 } },
    { session: { id: ID }, activity },
  ])("does not clear a request for an unverified reply", (bad) =>
    expect(isManualEnduranceAcknowledgement(submission, bad)).toBe(false),
  );
  it("normalizes offsets without inventing missing evidence", () => {
    expect(
      sameEnduranceActivity(activity, { ...activity, startedAt: "2026-10-08T00:30:00+03:00" }),
    ).toBe(true);
    expect(sameEnduranceActivity(activity, { ...activity, distanceMeters: null })).toBe(false);
  });
});
