import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/integrations/supabase/types";
import { finishWorkoutSession } from "./finish-workout.service";
import { loadCompletedSessionReplay } from "./session-replay.server";
import { UNASSIGNED_SESSION_REGION } from "./session-muscle-breakdown";

const dependencies = vi.hoisted(() => ({
  plan: vi.fn(),
  completion: vi.fn(),
  day: vi.fn(),
  decision: vi.fn(),
  timeline: vi.fn(),
}));
vi.mock("./active-plan.service", () => ({ getActivePlanData: dependencies.plan }));
vi.mock("./workout-completion.engine", () => ({
  evaluateWorkoutCompletion: dependencies.completion,
}));
vi.mock("./workout-session-plan.engine", () => ({ resolveWorkoutSessionDay: dependencies.day }));
vi.mock("./today-decision.server", () => ({
  completeCurrentTrainingDecision: dependencies.decision,
}));
vi.mock("./personal-timeline.server", () => ({
  recordPersonalTimelineEvent: dependencies.timeline,
}));

const USER = "10000000-0000-4000-8000-000000000001";
const SESSION = "20000000-0000-4000-8000-000000000002";
const PLAN = "30000000-0000-4000-8000-000000000003";
const input = { sessionId: SESSION, timeZone: "Europe/Vilnius" };
const openSession = {
  id: SESSION,
  plan_id: PLAN,
  day_index: 0,
  title: "Synthetic workout",
  started_at: "2026-09-06T09:00:00Z",
  finished_at: null,
  duration_seconds: null,
  total_volume: 0,
  adaptation_modifier: 1,
  workout_snapshot: null,
};
const finishedSession = {
  ...openSession,
  finished_at: "2026-09-06T10:00:00.000Z",
  duration_seconds: 3600,
  total_volume: 500,
};
const set = { exercise_slug: "bench", reps: 10, weight_kg: 50, done: true };
const logged = { ...set, id: "set-1", set_number: 1 };
const catalogue = [{ slug: "bench", muscle_group: "chest" }];
type Result = { data: unknown; error: { message: string } | null };
const ok = (data: unknown): Result => ({ data, error: null });
const failure = (data: unknown = null): Result => ({
  data,
  error: { message: "synthetic failure" },
});

/** Strict scripted query boundary, not a pretend Supabase integration test. */
class Query implements PromiseLike<Result> {
  readonly calls: Array<[string, unknown[]]> = [];
  constructor(
    readonly table: string,
    private readonly result: Result | Error,
  ) {}
  private call(name: string, args: unknown[]) {
    this.calls.push([name, args]);
    return this;
  }
  select(...args: unknown[]) {
    return this.call("select", args);
  }
  eq(...args: unknown[]) {
    return this.call("eq", args);
  }
  in(...args: unknown[]) {
    return this.call("in", args);
  }
  is(...args: unknown[]) {
    return this.call("is", args);
  }
  update(...args: unknown[]) {
    return this.call("update", args);
  }
  maybeSingle() {
    return this.call("maybeSingle", []);
  }
  then<T = Result, U = never>(
    resolve?: ((value: Result) => T | PromiseLike<T>) | null,
    reject?: ((error: unknown) => U | PromiseLike<U>) | null,
  ): Promise<T | U> {
    const result =
      this.result instanceof Error ? Promise.reject(this.result) : Promise.resolve(this.result);
    return result.then(resolve, reject);
  }
}
function client(...script: Array<[string, Result | Error]>) {
  const queries: Query[] = [];
  const from = vi.fn((table: string) => {
    const expected = script.shift();
    if (!expected || expected[0] !== table) throw new Error("Unexpected scripted query: " + table);
    const query = new Query(table, expected[1]);
    queries.push(query);
    return query;
  });
  // The only test-boundary cast: production always receives the authenticated typed client.
  const supabase = { from } as unknown as SupabaseClient<Database>;
  return { supabase, queries, remaining: () => script.length };
}
function expectUserScoped(queries: Query[]) {
  for (const query of queries.filter((item) => item.table !== "exercises")) {
    expect(query.calls).toContainEqual(["eq", ["user_id", USER]]);
    expect(query.calls).toContainEqual([
      "eq",
      [query.table === "set_logs" ? "session_id" : "id", SESSION],
    ]);
  }
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-06T10:00:00Z"));
  vi.spyOn(console, "warn").mockImplementation(() => {});
  dependencies.plan.mockResolvedValue({
    status: "READY",
    plan: { id: PLAN, data: { days: [{ day: 1 }] } },
  });
  dependencies.day.mockImplementation((_session, day) => day);
  dependencies.completion.mockReturnValue({
    canFinish: true,
    totalVolume: 500,
    missingSetKeys: [],
    unexpectedSetKeys: [],
  });
  dependencies.decision.mockResolvedValue(undefined);
  dependencies.timeline.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("finishWorkoutSession persistence and retry boundary", () => {
  it("reconstructs the same replay on repeated requests without revalidating a changed plan or rewriting history", async () => {
    const db = client(
      ["workout_sessions", ok(finishedSession)],
      ["set_logs", ok([set])],
      ["exercises", ok(catalogue)],
      ["workout_sessions", ok(finishedSession)],
      ["set_logs", ok([set])],
      ["exercises", ok(catalogue)],
    );
    const first = await finishWorkoutSession(db.supabase, USER, input);
    const second = await finishWorkoutSession(db.supabase, USER, input);
    expect(second).toEqual(first);
    expect(first).toMatchObject({
      ok: true,
      alreadyFinished: true,
      replayStatus: "available",
      session: { finishedAt: finishedSession.finished_at },
    });
    expect(first.muscleBreakdown).toEqual([
      {
        muscleGroup: "chest",
        volumeKg: 500,
        sets: 1,
        shareOfSession: 1,
        mappingStatus: "catalogue",
      },
    ]);
    expect(dependencies.plan).not.toHaveBeenCalled();
    expect(dependencies.completion).not.toHaveBeenCalled();
    expect(dependencies.decision).not.toHaveBeenCalled();
    expect(dependencies.timeline).not.toHaveBeenCalled();
    expect(db.queries.some((query) => query.calls.some(([method]) => method === "update"))).toBe(
      false,
    );
    expectUserScoped(db.queries);
    expect(db.remaining()).toBe(0);
  });

  it("allows replay of a completed historical session without current-plan metadata", async () => {
    const db = client(
      ["workout_sessions", ok({ ...finishedSession, plan_id: null, day_index: null })],
      ["set_logs", ok([set])],
      ["exercises", ok(catalogue)],
    );
    expect((await finishWorkoutSession(db.supabase, USER, input)).muscleBreakdown[0]?.sets).toBe(1);
    expect(dependencies.plan).not.toHaveBeenCalled();
  });

  it("persists completion before optional catalogue/enrichment reads", async () => {
    const db = client(
      ["workout_sessions", ok(openSession)],
      ["set_logs", ok([logged])],
      ["workout_sessions", ok(finishedSession)],
      ["exercises", ok(catalogue)],
    );
    const result = await finishWorkoutSession(db.supabase, USER, input);
    expect(result).toMatchObject({ ok: true, alreadyFinished: false, replayStatus: "available" });
    expect(db.queries.map((query) => query.table)).toEqual([
      "workout_sessions",
      "set_logs",
      "workout_sessions",
      "exercises",
    ]);
    expect(db.queries[2]?.calls).toContainEqual(["is", ["finished_at", null]]);
    expect(db.queries[2]?.calls).toContainEqual([
      "update",
      [{ finished_at: finishedSession.finished_at, duration_seconds: 3600, total_volume: 500 }],
    ]);
    expect(dependencies.timeline).toHaveBeenCalledTimes(1);
    expect(dependencies.decision).toHaveBeenCalledTimes(1);
    expectUserScoped(db.queries);
  });

  it("does not consult another user's logs after a missing/unauthorized parent row", async () => {
    const db = client(["workout_sessions", ok(null)]);
    await expect(finishWorkoutSession(db.supabase, USER, input)).rejects.toThrow("not found");
    expect(db.queries).toHaveLength(1);
    expectUserScoped(db.queries);
  });

  it("blocks completion on required set-log failure even if stale rows accompany the error", async () => {
    const db = client(["workout_sessions", ok(openSession)], ["set_logs", failure([logged])]);
    await expect(finishWorkoutSession(db.supabase, USER, input)).rejects.toThrow(
      "Set log lookup failed",
    );
    expect(dependencies.completion).not.toHaveBeenCalled();
    expect(db.queries).toHaveLength(2);
  });

  it("rejects incomplete planned work before any catalogue lookup or write", async () => {
    dependencies.completion.mockReturnValue({
      canFinish: false,
      missingSetKeys: ["bench:1"],
      totalVolume: 0,
    });
    const db = client(["workout_sessions", ok(openSession)], ["set_logs", ok([])]);
    await expect(finishWorkoutSession(db.supabase, USER, input)).rejects.toThrow(
      "1 planned set(s)",
    );
    expect(db.queries).toHaveLength(2);
  });

  it("does not mask a real persistence error as successful replay", async () => {
    const db = client(
      ["workout_sessions", ok(openSession)],
      ["set_logs", ok([logged])],
      ["workout_sessions", failure()],
    );
    await expect(finishWorkoutSession(db.supabase, USER, input)).rejects.toThrow(
      "Could not finish workout",
    );
    expect(dependencies.timeline).not.toHaveBeenCalled();
    expect(db.queries).toHaveLength(3);
  });

  it("recovers the winning completed row and current replay after a concurrent finish", async () => {
    const winner = {
      ...finishedSession,
      finished_at: "2026-09-06T09:59:59Z",
      duration_seconds: 3599,
    };
    const db = client(
      ["workout_sessions", ok(openSession)],
      ["set_logs", ok([logged])],
      ["workout_sessions", ok(null)],
      ["workout_sessions", ok(winner)],
      ["set_logs", ok([set])],
      ["exercises", ok(catalogue)],
    );
    const result = await finishWorkoutSession(db.supabase, USER, input);
    expect(result).toMatchObject({
      alreadyFinished: true,
      replayStatus: "available",
      session: { durationSeconds: 3599, finishedAt: winner.finished_at },
    });
    expect(result.muscleBreakdown[0]?.volumeKg).toBe(500);
    expect(dependencies.decision).not.toHaveBeenCalled();
    expect(dependencies.timeline).not.toHaveBeenCalled();
    expectUserScoped(db.queries);
  });

  it("does not call a zero-row update successful if a completed winner cannot be confirmed", async () => {
    const db = client(
      ["workout_sessions", ok(openSession)],
      ["set_logs", ok([logged])],
      ["workout_sessions", ok(null)],
      ["workout_sessions", ok(openSession)],
    );
    await expect(finishWorkoutSession(db.supabase, USER, input)).rejects.toThrow("still open");
    expect(dependencies.timeline).not.toHaveBeenCalled();
  });

  it("isolates failed optional follow-ups from committed completion and attempts each independently", async () => {
    dependencies.decision.mockRejectedValue(new Error("private details must not be logged"));
    dependencies.timeline.mockRejectedValue(new Error("private details must not be logged"));
    const db = client(
      ["workout_sessions", ok(openSession)],
      ["set_logs", ok([logged])],
      ["workout_sessions", ok(finishedSession)],
      ["exercises", ok(catalogue)],
    );
    expect((await finishWorkoutSession(db.supabase, USER, input)).ok).toBe(true);
    expect(dependencies.decision).toHaveBeenCalledTimes(1);
    expect(dependencies.timeline).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith("[FinishWorkout] DECISION_FOLLOWUP_FAILED");
    expect(console.warn).toHaveBeenCalledWith("[FinishWorkout] TIMELINE_FOLLOWUP_FAILED");
    expect(vi.mocked(console.warn).mock.calls.flat().join(" ")).not.toContain("private details");
  });

  it("returns a saved session with explicit replay failure, not a claimed empty workout", async () => {
    const db = client(["workout_sessions", ok(finishedSession)], ["set_logs", failure([set])]);
    const result = await finishWorkoutSession(db.supabase, USER, input);
    expect(result).toMatchObject({
      ok: true,
      alreadyFinished: true,
      replayStatus: "unavailable",
      muscleBreakdown: [],
      session: { totalVolume: 500 },
    });
    expect(db.queries).toHaveLength(2);
  });
});

describe("optional session replay evidence boundary", () => {
  it("does not trust catalogue rows returned together with an error", async () => {
    const db = client(["exercises", failure(catalogue)]);
    const result = await loadCompletedSessionReplay(db.supabase, USER, SESSION, [set]);
    expect(result.replayStatus).toBe("available");
    expect(result.muscleBreakdown).toEqual([
      {
        muscleGroup: UNASSIGNED_SESSION_REGION,
        sets: 1,
        volumeKg: 500,
        shareOfSession: 1,
        mappingStatus: "unavailable",
      },
    ]);
  });
  it("preserves counts when the catalogue query throws", async () => {
    const db = client(["exercises", new Error("transport")]);
    const result = await loadCompletedSessionReplay(db.supabase, USER, SESSION, [set]);
    expect(result.muscleBreakdown[0]).toMatchObject({ sets: 1, mappingStatus: "unavailable" });
    expect(result.replayStatus).toBe("available");
  });
  it("treats malformed catalogue results as unavailable mapping", async () => {
    const db = client(["exercises", ok([{ slug: "bench", muscle_group: null }])]);
    expect(
      (await loadCompletedSessionReplay(db.supabase, USER, SESSION, [set])).muscleBreakdown[0]
        ?.mappingStatus,
    ).toBe("unavailable");
  });
  it("distinguishes an empty successful catalogue from an unavailable one", async () => {
    const db = client(["exercises", ok([])]);
    expect(
      (await loadCompletedSessionReplay(db.supabase, USER, SESSION, [set])).muscleBreakdown[0]
        ?.mappingStatus,
    ).toBe("unassigned");
  });
  it("does not drop malformed logs and display the rest as a complete session", async () => {
    const db = client();
    expect(
      await loadCompletedSessionReplay(db.supabase, USER, SESSION, [
        set,
        { ...set, weight_kg: "bad" },
      ]),
    ).toEqual({ muscleBreakdown: [], replayStatus: "unavailable" });
    expect(db.queries).toHaveLength(0);
  });
  it("keeps successful empty data distinct from source failure and avoids needless catalogue reads", async () => {
    const db = client();
    expect(await loadCompletedSessionReplay(db.supabase, USER, SESSION, [])).toEqual({
      muscleBreakdown: [],
      replayStatus: "available",
    });
    expect(
      await loadCompletedSessionReplay(db.supabase, USER, SESSION, [{ ...set, done: null }]),
    ).toEqual({ muscleBreakdown: [], replayStatus: "available" });
    expect(db.queries).toHaveLength(0);
  });
  it("preserves completed counts while withholding an incomplete group volume", async () => {
    const db = client(["exercises", ok(catalogue)]);
    const result = await loadCompletedSessionReplay(db.supabase, USER, SESSION, [
      set,
      { ...set, weight_kg: null },
    ]);
    expect(result.muscleBreakdown[0]).toMatchObject({
      muscleGroup: "chest",
      sets: 2,
      volumeKg: null,
      shareOfSession: null,
    });
    expect(db.queries[0]?.calls).toContainEqual(["in", ["slug", ["bench"]]]);
  });
  it("converts replay transport failure to explicit unavailability with no fabricated counts", async () => {
    const db = client(["set_logs", new Error("transport")]);
    expect(await loadCompletedSessionReplay(db.supabase, USER, SESSION)).toEqual({
      muscleBreakdown: [],
      replayStatus: "unavailable",
    });
    expectUserScoped(db.queries);
  });
});
