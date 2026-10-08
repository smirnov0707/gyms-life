import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/integrations/supabase/types";
import { retryEnduranceRaceEnrichment } from "./endurance-race-enrichment.service";
import { recordEnduranceActivity } from "./endurance-activity.service";

const dependencies = vi.hoisted(() => ({
  prep: vi.fn(),
  zone: vi.fn(),
  adaptation: vi.fn(),
  admin: vi.fn(),
}));
vi.mock("./endurance-race-prep.service", () => ({ loadActiveRacePrep: dependencies.prep }));
vi.mock("./user-context.server", () => ({ loadPersistedProfileTimeZone: dependencies.zone }));
vi.mock("./endurance-adaptation-refresh.service", () => ({
  tryPersistCurrentEnduranceAdaptation: dependencies.adaptation,
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: dependencies.admin },
}));

const USER = "10000000-0000-4000-8000-000000000001";
const SESSION = "20000000-0000-4000-8000-000000000002";
const GOAL = "30000000-0000-4000-8000-000000000003";
const OTHER_GOAL = "40000000-0000-4000-8000-000000000004";
const input = { workoutSessionId: SESSION };
const saved = {
  id: SESSION,
  started_at: "2026-10-07T22:30:00.000Z",
  finished_at: "2026-10-07T23:00:00.000Z",
  duration_seconds: 1800,
  activity_kind: "run",
  activity_environment: "outdoor",
  activity_source: "manual",
  distance_meters: 5000,
  average_heart_rate_bpm: null,
  perceived_effort: 4,
  endurance_race_goal_id: null,
  endurance_plan_session_key: null,
  endurance_session_intent: null,
  endurance_match_source: null,
};
const linked = {
  ...saved,
  endurance_race_goal_id: GOAL,
  endurance_plan_session_key: "w1-s1",
  endurance_session_intent: "easy",
  endurance_match_source: "system_confident",
};
const activity = {
  kind: "run",
  environment: "outdoor",
  source: "manual",
  startedAt: saved.started_at,
  durationSeconds: 1800,
  distanceMeters: 5000,
  perceivedEffort: 4,
  averageHeartRateBpm: null,
};
const planned = {
  sessionKey: "w1-s1",
  intent: "easy",
  plannedDurationMinutes: 30,
  plannedDistanceMeters: 5000,
  intensityCue: "Synthetic easy effort",
};
const prep = {
  status: "active",
  goalId: GOAL,
  completedSessionKeys: [],
  effectiveSessions: [planned],
  intelligence: {
    action: "collect_evidence",
    confidence: "low",
    reasons: [],
    guardrails: [],
    nextSession: { intent: "easy", plannedDistanceMeters: 5000, volumeModifier: 1 },
  },
  readiness: { status: "insufficient_evidence", factors: [], evidenceLevel: "low" },
};
type Result = { data: unknown; error: { message: string; code?: string } | null };
const ok = (data: unknown): Result => ({ data, error: null });
const failure = (code?: string): Result => ({
  data: null,
  error: { message: "private health details", ...(code === undefined ? {} : { code }) },
});

/** Scripted PostgREST boundary. These tests are not a live RLS/SQL integration claim. */
class Query implements PromiseLike<Result> {
  readonly calls: Array<[string, unknown[]]> = [];
  constructor(private readonly result: Result | Error) {}
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
  is(...args: unknown[]) {
    return this.call("is", args);
  }
  not(...args: unknown[]) {
    return this.call("not", args);
  }
  update(...args: unknown[]) {
    return this.call("update", args);
  }
  insert(...args: unknown[]) {
    return this.call("insert", args);
  }
  single() {
    return this.call("single", []);
  }
  maybeSingle() {
    return this.call("maybeSingle", []);
  }
  then<T = Result, U = never>(
    resolve?: ((value: Result) => T | PromiseLike<T>) | null,
    reject?: ((error: unknown) => U | PromiseLike<U>) | null,
  ): Promise<T | U> {
    return (
      this.result instanceof Error ? Promise.reject(this.result) : Promise.resolve(this.result)
    ).then(resolve, reject);
  }
}
function client(...script: Array<Result | Error>) {
  const queries: Query[] = [];
  const from = vi.fn((table: string) => {
    expect(table).toBe("workout_sessions");
    const result = script.shift();
    if (!result) throw new Error("Unscripted query");
    const query = new Query(result);
    queries.push(query);
    return query;
  });
  // Test-only structural adapter; application code uses the typed authenticated client.
  const supabase = { from } as unknown as SupabaseClient<Database>;
  return { supabase, queries, from, remaining: () => script.length };
}
function writer(result: Result = ok({ id: SESSION })) {
  const query = new Query(result);
  dependencies.admin.mockReturnValue(query);
  return query;
}
function scoped(queries: Query[]) {
  for (const query of queries) {
    expect(query.calls).toContainEqual(["eq", ["user_id", USER]]);
    expect(query.calls).toContainEqual(["eq", ["id", SESSION]]);
    expect(query.calls).toContainEqual(["eq", ["activity_kind", "run"]]);
    expect(query.calls).toContainEqual(["not", ["finished_at", "is", null]]);
    expect(query.calls.some(([name]) => name === "insert")).toBe(false);
  }
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-08T06:00:00Z"));
  vi.spyOn(console, "warn").mockImplementation(() => {});
  dependencies.zone.mockResolvedValue("Europe/Vilnius");
  dependencies.prep.mockResolvedValue(prep);
  dependencies.adaptation.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("owned saved-run enrichment retries", () => {
  it.each([
    { workoutSessionId: "not-a-uuid" },
    { ...input, distanceMeters: 8000 },
    { ...input, userId: USER },
  ])("rejects replacement evidence or identity before reading: %j", async (invalid) => {
    const db = client();
    await expect(retryEnduranceRaceEnrichment(db.supabase, USER, invalid)).rejects.toThrow();
    expect(db.from).not.toHaveBeenCalled();
    expect(dependencies.admin).not.toHaveBeenCalled();
  });

  it.each([ok(null), failure(), new Error("private health details")])(
    "does not enrich an unreadable or unavailable run",
    async (result) => {
      const db = client(result);
      await expect(retryEnduranceRaceEnrichment(db.supabase, USER, input)).rejects.toThrow();
      expect(dependencies.prep).not.toHaveBeenCalled();
      expect(dependencies.admin).not.toHaveBeenCalled();
      scoped(db.queries);
    },
  );

  it("distinguishes no active plan from a failed classification", async () => {
    const db = client(ok(saved));
    dependencies.prep.mockResolvedValue({ status: "none" });
    const result = await retryEnduranceRaceEnrichment(db.supabase, USER, input);
    expect(result.raceEnrichment).toEqual({
      status: "no_active_plan",
      linked: false,
      retryable: false,
    });
    expect(console.warn).not.toHaveBeenCalled();
    expect(dependencies.admin).not.toHaveBeenCalled();
    scoped(db.queries);
  });

  it("preserves missing distance instead of inventing a candidate", async () => {
    const db = client(ok({ ...saved, distance_meters: null }));
    const result = await retryEnduranceRaceEnrichment(db.supabase, USER, input);
    expect(result.raceMatch).toMatchObject({ status: "no_match", reason: "insufficient_evidence" });
    expect(result.raceEnrichment.status).toBe("no_match");
    expect(dependencies.admin).not.toHaveBeenCalled();
  });

  it("keeps distance-only evidence pending user confirmation", async () => {
    const db = client(ok({ ...saved, perceived_effort: null }));
    const result = await retryEnduranceRaceEnrichment(db.supabase, USER, input);
    expect(result.raceMatch).toMatchObject({
      status: "needs_confirmation",
      raceGoalId: GOAL,
      plannedSessionKey: "w1-s1",
      intent: "easy",
    });
    expect(result.raceEnrichment.status).toBe("needs_confirmation");
    expect(dependencies.admin).not.toHaveBeenCalled();
  });

  it("does not consume a session already credited to another run", async () => {
    const db = client(ok(saved));
    dependencies.prep.mockResolvedValue({ ...prep, completedSessionKeys: ["w1-s1"] });
    const result = await retryEnduranceRaceEnrichment(db.supabase, USER, input);
    expect(result.raceMatch).toMatchObject({ status: "no_match", reason: "no_planned_sessions" });
    expect(dependencies.admin).not.toHaveBeenCalled();
  });

  it("matches canonical persisted evidence in the athlete's local day and proves the conditional write", async () => {
    const db = client(ok(saved));
    const update = writer();
    const result = await retryEnduranceRaceEnrichment(db.supabase, USER, input);
    expect(result.raceEnrichment).toEqual({ status: "matched", linked: true, retryable: false });
    expect(result.raceMatch).toMatchObject({ status: "confident", plannedSessionKey: "w1-s1" });
    expect(dependencies.prep).toHaveBeenCalledWith(
      db.supabase,
      USER,
      "2026-10-08",
      "Europe/Vilnius",
    );
    expect(update.calls).toContainEqual([
      "update",
      [
        {
          endurance_race_goal_id: GOAL,
          endurance_plan_session_key: "w1-s1",
          endurance_session_intent: "easy",
          endurance_match_source: "system_confident",
          endurance_match_score: 1,
        },
      ],
    ]);
    for (const field of [
      "endurance_match_source",
      "endurance_race_goal_id",
      "endurance_plan_session_key",
      "endurance_session_intent",
    ])
      expect(update.calls).toContainEqual(["is", [field, null]]);
    expect(update.calls).toContainEqual(["select", ["id"]]);
    expect(update.calls).toContainEqual(["maybeSingle", []]);
    scoped([...db.queries, update]);
    expect(dependencies.adaptation).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, "23505"])(
    "returns an explicit retryable result on link-write failure (%s)",
    async (code) => {
      const db = client(ok(saved));
      writer(failure(code));
      const result = await retryEnduranceRaceEnrichment(db.supabase, USER, input);
      expect(result.raceMatch).toBeNull();
      expect(result.raceEnrichment).toEqual({
        status: "unavailable",
        stage: "link",
        linked: false,
        retryable: true,
      });
      expect(dependencies.adaptation).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledWith("[Endurance] RACE_ENRICHMENT_LINK_FAILED");
      expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain(
        "private health details",
      );
    },
  );

  it("does not treat a zero-row update as a successful match", async () => {
    const db = client(ok(saved), ok(saved));
    writer(ok(null));
    const result = await retryEnduranceRaceEnrichment(db.supabase, USER, input);
    expect(result.raceEnrichment).toMatchObject({
      status: "unavailable",
      stage: "link",
      linked: false,
    });
    expect(db.remaining()).toBe(0);
    scoped(db.queries);
  });

  it("preserves a concurrently user-confirmed match instead of overwriting it", async () => {
    const db = client(ok(saved), ok({ ...linked, endurance_match_source: "user_confirmed" }));
    writer(ok(null));
    const result = await retryEnduranceRaceEnrichment(db.supabase, USER, input);
    expect(result.raceEnrichment.status).toBe("matched");
    expect(result.raceMatch).toBeNull();
    expect(dependencies.admin).toHaveBeenCalledTimes(1);
    expect(dependencies.adaptation).not.toHaveBeenCalled();
    scoped(db.queries);
  });

  it("does not attach the losing request's intelligence to a different winning goal", async () => {
    const db = client(ok(saved), ok({ ...linked, endurance_race_goal_id: OTHER_GOAL }));
    writer(ok(null));
    const result = await retryEnduranceRaceEnrichment(db.supabase, USER, input);
    expect(result.raceEnrichment.status).toBe("matched");
    expect(result.raceIntelligence).toBeNull();
  });

  it("keeps the successful link when the subsequent analysis fails", async () => {
    const db = client(ok(saved));
    writer();
    dependencies.prep
      .mockResolvedValueOnce(prep)
      .mockRejectedValueOnce(new Error("private health details"));
    const result = await retryEnduranceRaceEnrichment(db.supabase, USER, input);
    expect(result.raceEnrichment).toEqual({
      status: "unavailable",
      stage: "refresh",
      linked: true,
      retryable: true,
    });
    expect(console.warn).toHaveBeenCalledWith("[Endurance] RACE_ENRICHMENT_REFRESH_FAILED");
  });

  it("retries after a post-commit failure without matching the same run to a second plan slot", async () => {
    const db = client(ok(saved), ok(linked));
    writer();
    dependencies.prep
      .mockResolvedValueOnce(prep)
      .mockRejectedValueOnce(new Error("synthetic post-commit failure"))
      .mockResolvedValueOnce({
        ...prep,
        completedSessionKeys: ["w1-s1"],
        effectiveSessions: [{ ...planned, sessionKey: "w1-s2" }],
      });
    const first = await retryEnduranceRaceEnrichment(db.supabase, USER, input);
    const second = await retryEnduranceRaceEnrichment(db.supabase, USER, input);
    expect(first.raceEnrichment).toMatchObject({ status: "unavailable", linked: true });
    expect(second.raceEnrichment).toEqual({ status: "matched", linked: true, retryable: false });
    expect(dependencies.admin).toHaveBeenCalledTimes(1);
    expect(dependencies.adaptation).toHaveBeenCalledTimes(1);
    expect(db.remaining()).toBe(0);
    scoped(db.queries);
  });

  it("keeps a historical link even when the active plan has ended", async () => {
    const db = client(ok(linked));
    dependencies.prep.mockResolvedValue({ status: "none" });
    const result = await retryEnduranceRaceEnrichment(db.supabase, USER, input);
    expect(result.raceEnrichment).toEqual({ status: "matched", linked: true, retryable: false });
    expect(dependencies.admin).not.toHaveBeenCalled();
  });

  it("does not invent an unmatched status if reading the plan fails for a linked run", async () => {
    const db = client(ok(linked));
    dependencies.prep.mockRejectedValue(new Error("private details"));
    const result = await retryEnduranceRaceEnrichment(db.supabase, USER, input);
    expect(result.raceEnrichment).toMatchObject({
      status: "unavailable",
      linked: true,
      stage: "classify",
    });
    expect(dependencies.admin).not.toHaveBeenCalled();
  });

  it("does not overwrite partial legacy match metadata", async () => {
    const db = client(ok({ ...saved, endurance_plan_session_key: "w1-s1" }));
    const result = await retryEnduranceRaceEnrichment(db.supabase, USER, input);
    expect(result.raceEnrichment.status).toBe("unavailable");
    expect(dependencies.admin).not.toHaveBeenCalled();
    expect(dependencies.prep).not.toHaveBeenCalled();
  });
});

describe("primary recording is independent from secondary matching", () => {
  const inserted = { id: SESSION, started_at: saved.started_at, finished_at: saved.finished_at };
  it("retains the canonical insert and credit when the saved-run readback fails", async () => {
    const db = client(ok(inserted), failure());
    const result = await recordEnduranceActivity(db.supabase, USER, activity);
    expect(result.session).toEqual(inserted);
    expect(result.credit.status).toBe("credited");
    expect(result.raceEnrichment).toMatchObject({
      status: "unavailable",
      stage: "load",
      linked: false,
    });
    expect(db.queries.flatMap((q) => q.calls).filter(([name]) => name === "insert")).toHaveLength(
      1,
    );
    expect(console.warn).toHaveBeenCalledWith("[Endurance] RACE_ENRICHMENT_LOAD_FAILED");
  });

  it("does not turn a successful save into a failure when matching is unavailable", async () => {
    const db = client(ok(inserted), ok(saved));
    dependencies.prep.mockRejectedValue(new Error("private health details"));
    const result = await recordEnduranceActivity(db.supabase, USER, activity);
    expect(result.session.id).toBe(SESSION);
    expect(result.raceEnrichment).toMatchObject({ status: "unavailable", stage: "classify" });
    expect(db.queries.flatMap((q) => q.calls).filter(([name]) => name === "insert")).toHaveLength(
      1,
    );
  });

  it("keeps a failed primary insert as a real failure and does not enrich", async () => {
    const db = client(failure());
    await expect(recordEnduranceActivity(db.supabase, USER, activity)).rejects.toMatchObject({
      message: "private health details",
    });
    expect(dependencies.prep).not.toHaveBeenCalled();
    expect(db.queries).toHaveLength(1);
  });

  it("does not run race matching for walks", async () => {
    const db = client(ok(inserted));
    const result = await recordEnduranceActivity(db.supabase, USER, { ...activity, kind: "walk" });
    expect(result.raceEnrichment.status).toBe("not_applicable");
    expect(db.queries).toHaveLength(1);
    expect(dependencies.prep).not.toHaveBeenCalled();
  });
});
