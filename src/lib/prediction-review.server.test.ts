import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { reviewPendingWorkoutPredictions } from "./prediction-review.server";
const USER = "11111111-1111-4111-8111-111111111111",
  ID = "22222222-2222-4222-8222-222222222222",
  PRED = "33333333-3333-4333-8333-333333333333";
const prediction = {
  id: PRED,
  target: "workout_completion",
  generatedAt: "2026-09-08T08:00:00Z",
  horizonEndsAt: "2026-09-08T20:59:59Z",
  modelId: "workout-completion",
  modelVersion: "1.0",
  maturity: "shadow",
  athleteStateSnapshotId: null,
  evidenceLevel: "early",
  evidence: [],
  predicted: { kind: "probability", value: 0.6 },
  actual: null,
  evaluatedAt: null,
};
const row = { id: ID, decision_on: "2026-09-08", prediction },
  now = new Date("2026-09-09T03:00:00Z");
function db(results: Array<{ data: unknown; error: unknown }>) {
  const calls: Array<{ table: string; methods: Array<[string, unknown[]]> }> = [];
  const client = {
    from: (table: string) => {
      const call = { table, methods: [] as Array<[string, unknown[]]> };
      calls.push(call);
      if (!results.length) throw new Error("Unexpected database call");
      const result = Promise.resolve(results.shift());
      const query = new Proxy(
        {},
        {
          get: (_t, key) =>
            key === "then"
              ? result.then.bind(result)
              : (...args: unknown[]) => {
                  call.methods.push([String(key), args]);
                  return query;
                },
        },
      );
      return query;
    },
  } as unknown as SupabaseClient<Database>;
  return { client, calls };
}
const ok = (data: unknown) => ({ data, error: null });
describe("falsifiable prediction review", () => {
  it("empty pending queue means zero checked, not zero forecast accuracy", async () => {
    const d = db([ok([])]);
    expect(await reviewPendingWorkoutPredictions(d.client, USER, now)).toEqual({
      checked: 0,
      evaluated: 0,
      independentDays: 0,
      pending: 0,
      limited: false,
    });
    expect(d.calls).toHaveLength(1);
    expect(d.calls[0]!.methods).toContainEqual([
      "contains",
      [
        "prediction",
        { target: "workout_completion", maturity: "shadow", actual: null, evaluatedAt: null },
      ],
    ]);
  });
  it("a completion within the forecast window is written once with exact prediction identity guards", async () => {
    const d = db([ok([row]), ok([{ finished_at: "2026-09-08T18:00:00Z" }]), ok([{ id: ID }])]);
    expect(await reviewPendingWorkoutPredictions(d.client, USER, now)).toMatchObject({
      evaluated: 1,
      independentDays: 1,
      pending: 0,
    });
    const write = d.calls[2]!;
    expect(write.methods).toContainEqual([
      "contains",
      [
        "prediction",
        { id: PRED, generatedAt: prediction.generatedAt, actual: null, evaluatedAt: null },
      ],
    ]);
    for (const call of d.calls) expect(call.methods).toContainEqual(["eq", ["user_id", USER]]);
  });
  it("absence is not non-completion while the horizon is still open", async () => {
    const d = db([ok([row]), ok([])]);
    expect(
      await reviewPendingWorkoutPredictions(d.client, USER, new Date("2026-09-08T12:00:00Z")),
    ).toMatchObject({ evaluated: 0, pending: 1 });
    expect(d.calls).toHaveLength(2);
  });
  it("a complete readable source can establish non-completion after the horizon", async () => {
    const d = db([ok([row]), ok([]), ok([{ id: ID }])]);
    expect((await reviewPendingWorkoutPredictions(d.client, USER, now)).evaluated).toBe(1);
    expect(d.calls[2]!.methods.find((m) => m[0] === "update")?.[1][0]).toMatchObject({
      prediction: { actual: { kind: "boolean", value: false } },
    });
  });
  it.each([null, Array.from({ length: 513 }, () => ({ finished_at: "2026-09-08T18:00:00Z" }))])(
    "missing/truncated completion data cannot produce a false negative",
    async (sessions) => {
      const d = db([ok([row]), ok(sessions)]);
      await expect(reviewPendingWorkoutPredictions(d.client, USER, now)).rejects.toThrow(
        "PREDICTION_COMPLETIONS_UNAVAILABLE",
      );
      expect(d.calls).toHaveLength(2);
    },
  );
  it("a failed source query is not treated as an empty history", async () => {
    const d = db([ok([row]), { data: null, error: { message: "private database error" } }]);
    await expect(reviewPendingWorkoutPredictions(d.client, USER, now)).rejects.toThrow(
      "PREDICTION_COMPLETIONS_UNAVAILABLE",
    );
  });
  it("another worker's completed update is not counted again", async () => {
    const d = db([ok([row]), ok([]), ok([])]);
    expect((await reviewPendingWorkoutPredictions(d.client, USER, now)).evaluated).toBe(0);
  });
  it("multiple records from one decision date do not become multiple independent days", async () => {
    const next = {
      ...row,
      id: "44444444-4444-4444-8444-444444444444",
      prediction: { ...prediction, id: "55555555-5555-4555-8555-555555555555" },
    };
    const d = db([ok([row, next]), ok([]), ok([{ id: ID }]), ok([{ id: next.id }])]);
    expect(await reviewPendingWorkoutPredictions(d.client, USER, now)).toMatchObject({
      checked: 2,
      evaluated: 2,
      independentDays: 1,
    });
  });
  it("unconfirmed update responses cannot be counted as successful evaluation", async () => {
    const d = db([ok([row]), ok([]), ok(null)]);
    await expect(reviewPendingWorkoutPredictions(d.client, USER, now)).rejects.toThrow(
      "PREDICTION_REVIEW_WRITE_FAILED",
    );
  });
});
