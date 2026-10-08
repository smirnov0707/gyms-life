import { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/integrations/supabase/types";
import { synchronizeEnduranceRace } from "./endurance-race-sync.service";

const deps = vi.hoisted(() => ({ prep: vi.fn(), zone: vi.fn(), audit: vi.fn(), admin: vi.fn() }));
vi.mock("./endurance-race-prep.service", () => ({ loadActiveRacePrep: deps.prep }));
vi.mock("./user-context.server", () => ({ loadPersistedProfileTimeZone: deps.zone }));
vi.mock("./endurance-adaptation-refresh.service", () => ({
  tryPersistCurrentEnduranceAdaptation: deps.audit,
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() {
    return deps.admin();
  },
}));

const USER = "10000000-0000-4000-8000-000000000001";
const RUN = "20000000-0000-4000-8000-000000000002";
const GOAL = "30000000-0000-4000-8000-000000000003";
const OLD_GOAL = "40000000-0000-4000-8000-000000000004";
const row = {
  id: RUN,
  started_at: "2026-10-07T22:30:00+00:00",
  finished_at: "2026-10-07T23:00:00+00:00",
  distance_meters: 5000,
  duration_seconds: 1800,
  perceived_effort: 4,
  endurance_race_goal_id: null,
  endurance_plan_session_key: null,
  endurance_session_intent: null,
  endurance_match_source: null,
};
const linked = {
  ...row,
  endurance_race_goal_id: GOAL,
  endurance_plan_session_key: "w1-s1",
  endurance_session_intent: "easy",
  endurance_match_source: "user_confirmed",
};
const prep = {
  status: "active",
  goalId: GOAL,
  completedSessionKeys: [],
  effectiveSessions: [
    {
      sessionKey: "w1-s1",
      intent: "easy",
      plannedDistanceMeters: 5000,
      plannedDurationMinutes: 30,
      intensityCue: "Synthetic easy run",
    },
  ],
  intelligence: { action: "synthetic" },
  readiness: { status: "synthetic" },
};

type Reply = { body: unknown; status?: number };
type RequestLog = { method: string; url: URL; body: unknown };
/** Real supabase-js query construction against scripted HTTP responses; no live database. */
function boundary(...replies: Reply[]) {
  const requests: RequestLog[] = [];
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
    );
    requests.push({
      method: init?.method ?? "GET",
      url,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
    });
    const next = replies.shift();
    if (!next) throw new Error("Unexpected synthetic request");
    return new Response(JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  });
  const client = new SupabaseClient<Database>("https://synthetic.invalid", "synthetic-test-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch },
  });
  return { client, requests, remaining: () => replies.length };
}
const ok = (value: unknown): Reply => ({ body: value });
const fail = (code: string): Reply => ({
  body: {
    code,
    message: "PRIVATE ROW DETAILS MUST NOT BE LOGGED",
    details: "private",
    hint: "private",
  },
  status: 409,
});
const input = { workoutSessionId: RUN };
function assertScoped(request: RequestLog | undefined) {
  if (!request) throw new Error("Expected a scoped request");
  expect(request.url.pathname).toBe("/rest/v1/workout_sessions");
  expect(request.url.searchParams.get("id")).toBe(`eq.${RUN}`);
  expect(request.url.searchParams.get("user_id")).toBe(`eq.${USER}`);
  expect(request.url.searchParams.get("activity_kind")).toBe("eq.run");
  return request;
}

beforeEach(() => {
  vi.resetAllMocks();
  deps.zone.mockResolvedValue("Europe/Vilnius");
  deps.prep.mockResolvedValue(prep);
  deps.audit.mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("retrying enrichment of an existing completed run", () => {
  it("rejects caller-supplied identity or measurements before accessing data", async () => {
    const b = boundary();
    for (const value of [
      { workoutSessionId: "bad" },
      { ...input, userId: USER },
      { ...input, distanceMeters: 10000 },
    ]) {
      await expect(synchronizeEnduranceRace(b.client, USER, value)).rejects.toThrow();
    }
    expect(b.requests).toHaveLength(0);
  });

  it("requires an owned completed run and does not use privileged reads", async () => {
    const b = boundary(ok([]));
    expect((await synchronizeEnduranceRace(b.client, USER, input)).raceSync).toEqual({
      status: "deferred",
      phase: "matching",
    });
    const read = assertScoped(b.requests[0]);
    expect(read.url.searchParams.get("finished_at")).toBe("not.is.null");
    expect(deps.admin).not.toHaveBeenCalled();
    expect(deps.prep).not.toHaveBeenCalled();
  });

  it("reports failed reads separately from no active plan and redacts database errors", async () => {
    const b = boundary(fail("42501"));
    const result = await synchronizeEnduranceRace(b.client, USER, input);
    expect(result.raceSync.status).toBe("deferred");
    expect(result.raceMatch).toBeNull();
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toMatch(/PRIVATE|private/);
    expect(console.error).toHaveBeenCalledWith(expect.any(String), {
      workoutSessionId: RUN,
      phase: "matching",
      code: "42501",
    });
    expect(deps.admin).not.toHaveBeenCalled();
  });

  it.each([
    { duration_seconds: null },
    { distance_meters: -1 },
    { perceived_effort: 99 },
    { finished_at: null },
    { endurance_match_source: "invented" },
  ])("rejects malformed stored evidence %j", async (invalid) => {
    const b = boundary(ok([{ ...row, ...invalid }]));
    expect((await synchronizeEnduranceRace(b.client, USER, input)).raceSync.status).toBe(
      "deferred",
    );
    expect(deps.prep).not.toHaveBeenCalled();
    expect(deps.admin).not.toHaveBeenCalled();
  });

  it("uses the persisted athlete timezone and original run day, not retry day", async () => {
    const b = boundary(ok([row]));
    deps.prep.mockResolvedValue({ status: "none" });
    expect((await synchronizeEnduranceRace(b.client, USER, input)).raceSync).toEqual({
      status: "no_active_plan",
    });
    expect(deps.prep).toHaveBeenCalledWith(b.client, USER, "2026-10-08", "Europe/Vilnius");
    expect(deps.admin).not.toHaveBeenCalled();
  });

  it("does not silently turn unavailable plan evidence into an empty plan", async () => {
    const b = boundary(ok([row]));
    deps.prep.mockRejectedValue(new Error("private plan failure"));
    expect((await synchronizeEnduranceRace(b.client, USER, input)).raceSync).toEqual({
      status: "deferred",
      phase: "matching",
    });
    expect(deps.admin).not.toHaveBeenCalled();
  });

  it("returns no-match without inventing distance", async () => {
    const b = boundary(ok([{ ...row, distance_meters: null }]));
    const result = await synchronizeEnduranceRace(b.client, USER, input);
    expect(result.raceSync.status).toBe("no_match");
    expect(result.raceMatch?.status).toBe("no_match");
    expect(deps.admin).not.toHaveBeenCalled();
  });

  it("retains user confirmation for ambiguous evidence; retry is not consent", async () => {
    const b = boundary(ok([{ ...row, perceived_effort: null }]));
    const result = await synchronizeEnduranceRace(b.client, USER, input);
    expect(result.raceSync.status).toBe("needs_confirmation");
    expect(result.raceMatch).toMatchObject({
      status: "needs_confirmation",
      intent: "easy",
      raceGoalId: GOAL,
      plannedSessionKey: "w1-s1",
    });
    expect(deps.admin).not.toHaveBeenCalled();
  });

  it("never offers an already completed planned session", async () => {
    const b = boundary(ok([row]));
    deps.prep.mockResolvedValue({ ...prep, completedSessionKeys: ["w1-s1"] });
    const result = await synchronizeEnduranceRace(b.client, USER, input);
    expect(result.raceMatch).toMatchObject({ status: "no_match", reason: "no_planned_sessions" });
    expect(deps.admin).not.toHaveBeenCalled();
  });

  it("persists a confident match with compare-and-set and checks the returned row", async () => {
    const b = boundary(ok([row]));
    const admin = boundary(ok([{ id: RUN }]));
    deps.admin.mockReturnValue(admin.client);
    const result = await synchronizeEnduranceRace(b.client, USER, input);
    expect(result.raceSync.status).toBe("matched");
    expect(result.raceMatch).toMatchObject({
      status: "confident",
      plannedSessionKey: "w1-s1",
      raceGoalId: GOAL,
    });
    const write = assertScoped(admin.requests[0]);
    expect(write.method).toBe("PATCH");
    expect(write.body).toEqual({
      endurance_race_goal_id: GOAL,
      endurance_plan_session_key: "w1-s1",
      endurance_session_intent: "easy",
      endurance_match_source: "system_confident",
      endurance_match_score: 1,
    });
    for (const key of [
      "endurance_race_goal_id",
      "endurance_plan_session_key",
      "endurance_match_source",
    ])
      expect(write.url.searchParams.get(key)).toBe("is.null");
    for (const key of [
      "started_at",
      "finished_at",
      "duration_seconds",
      "distance_meters",
      "perceived_effort",
    ] as const)
      expect(write.url.searchParams.get(key)).toBe(`eq.${row[key]}`);
    expect(write.url.searchParams.get("select")).toBe("id");
    expect(admin.remaining()).toBe(0);
    expect(deps.audit).toHaveBeenCalledTimes(1);
  });

  it("a repeated request keeps the existing user-confirmed link without rewriting it", async () => {
    const b = boundary(ok([linked]), ok([linked]));
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await synchronizeEnduranceRace(b.client, USER, input);
      expect(result.raceSync.status).toBe("matched");
      expect(result.raceMatch).toMatchObject({
        status: "already_linked",
        plannedSessionKey: "w1-s1",
      });
    }
    expect(deps.admin).not.toHaveBeenCalled();
    expect(b.requests.every((r) => r.method === "GET")).toBe(true);
  });

  it("does not move a historical match to the currently active goal", async () => {
    const b = boundary(ok([{ ...linked, endurance_race_goal_id: OLD_GOAL }]));
    const result = await synchronizeEnduranceRace(b.client, USER, input);
    expect(result.raceMatch).toMatchObject({ raceGoalId: OLD_GOAL, status: "already_linked" });
    expect(result.raceIntelligence).toBeNull();
    expect(deps.admin).not.toHaveBeenCalled();
    expect(deps.audit).not.toHaveBeenCalled();
  });

  it("keeps a committed match if its plan is no longer active", async () => {
    const b = boundary(ok([linked]));
    deps.prep.mockResolvedValue({ status: "none" });
    expect((await synchronizeEnduranceRace(b.client, USER, input)).raceSync.status).toBe("matched");
    expect(deps.admin).not.toHaveBeenCalled();
  });

  it.each([ok([]), fail("23505")])(
    "accepts a concurrent winner only after rereading the owned run (%j)",
    async (response) => {
      const b = boundary(ok([row]), ok([linked]));
      const admin = boundary(response);
      deps.admin.mockReturnValue(admin.client);
      const result = await synchronizeEnduranceRace(b.client, USER, input);
      expect(result.raceMatch?.status).toBe("already_linked");
      expect(result.raceSync.status).toBe("matched");
      expect(admin.requests).toHaveLength(1);
      expect(b.requests).toHaveLength(2);
      b.requests.forEach(assertScoped);
    },
  );

  it.each([ok([]), fail("23505")])(
    "does not report a collision or zero-row update as success (%j)",
    async (response) => {
      const b = boundary(ok([row]), ok([row]));
      const admin = boundary(response);
      deps.admin.mockReturnValue(admin.client);
      const result = await synchronizeEnduranceRace(b.client, USER, input);
      expect(result.raceSync).toEqual({ status: "deferred", phase: "matching" });
      expect(result.raceMatch).toBeNull();
      expect(admin.requests).toHaveLength(1);
      expect(deps.audit).not.toHaveBeenCalled();
    },
  );

  it("does not replace a partial or orphaned association", async () => {
    const b = boundary(ok([{ ...row, endurance_plan_session_key: "w1-s1" }]));
    expect((await synchronizeEnduranceRace(b.client, USER, input)).raceSync.status).toBe(
      "deferred",
    );
    expect(deps.admin).not.toHaveBeenCalled();
  });

  it("recovers an acknowledged-as-failed update by reading the same saved run", async () => {
    const b = boundary(ok([row]), ok([linked]));
    const admin = boundary(fail("08006"));
    deps.admin.mockReturnValue(admin.client);
    expect((await synchronizeEnduranceRace(b.client, USER, input)).raceSync.status).toBe(
      "deferred",
    );
    expect((await synchronizeEnduranceRace(b.client, USER, input)).raceSync.status).toBe("matched");
    expect(admin.requests).toHaveLength(1);
    expect([...b.requests, ...admin.requests].some((r) => r.method === "POST")).toBe(false);
  });

  it("preserves a successful match when only the downstream refresh fails", async () => {
    const b = boundary(ok([row]));
    const admin = boundary(ok([{ id: RUN }]));
    deps.admin.mockReturnValue(admin.client);
    deps.prep.mockResolvedValueOnce(prep).mockRejectedValueOnce(new Error("refresh failed"));
    const result = await synchronizeEnduranceRace(b.client, USER, input);
    expect(result.raceSync).toEqual({ status: "deferred", phase: "insights" });
    expect(result.raceMatch?.status).toBe("confident");
    expect(result.raceIntelligence).toBeNull();
  });

  it("never labels an unverified returned row as the saved match", async () => {
    const b = boundary(ok([row]));
    const admin = boundary(ok([{ id: OLD_GOAL }]));
    deps.admin.mockReturnValue(admin.client);
    expect((await synchronizeEnduranceRace(b.client, USER, input)).raceSync.status).toBe(
      "deferred",
    );
    expect(deps.audit).not.toHaveBeenCalled();
  });
});
