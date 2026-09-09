import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { activateValidatedTrainingPlan } from "./training-activation.service";
import { USER, TRAINING_ID, VERSION, trainingPlan } from "../../tests/core-browser/fixtures";
const row = {
  id: TRAINING_ID,
  title: trainingPlan.title,
  goal: "lose_fat",
  weeks: 8,
  days_per_week: 3,
  created_at: VERSION,
  data: trainingPlan,
};
type Result = { data: unknown; error: { message: string } | null };
function database(results: Result[], rpcResult: Result = { data: TRAINING_ID, error: null }) {
  const calls: Array<[string, string, unknown[]]> = [];
  const from = vi.fn((table: string) => {
    const result = results.shift();
    if (!result) throw new Error("Unexpected synthetic query");
    const promise = Promise.resolve(result);
    const query = new Proxy(
      {},
      {
        get: (_target, key) =>
          key === "then"
            ? promise.then.bind(promise)
            : (...args: unknown[]) => {
                calls.push([table, String(key), args]);
                return query;
              },
      },
    );
    return query;
  });
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  return { client: { from, rpc } as unknown as SupabaseClient<Database>, calls, rpc };
}
const ok = (data: unknown): Result => ({ data, error: null });
describe("validated training programme activation", () => {
  it("validates owned data, checks unfinished sessions, then uses the atomic existing activation RPC", async () => {
    const db = database([ok(row), ok(null)]);
    await expect(activateValidatedTrainingPlan(db.client, USER, TRAINING_ID)).resolves.toBe(
      TRAINING_ID,
    );
    expect(db.calls).toContainEqual(["plans", "eq", ["user_id", USER]]);
    expect(db.calls).toContainEqual(["workout_sessions", "eq", ["user_id", USER]]);
    expect(db.calls).toContainEqual(["workout_sessions", "is", ["finished_at", null]]);
    expect(db.rpc).toHaveBeenCalledWith("activate_training_plan", { p_plan_id: TRAINING_ID });
  });
  it.each([null, { ...row, data: {} }, { ...row, days_per_week: 5 }])(
    "does not activate absent or inconsistent owned data: %j",
    async (candidate) => {
      const db = database([ok(candidate)]);
      await expect(activateValidatedTrainingPlan(db.client, USER, TRAINING_ID)).rejects.toThrow(
        /TRAINING_PLAN/,
      );
      expect(db.rpc).not.toHaveBeenCalled();
    },
  );
  it("preserves the current programme while a different workout remains unfinished", async () => {
    const db = database([ok(row), ok({ id: "open-session" })]);
    await expect(activateValidatedTrainingPlan(db.client, USER, TRAINING_ID)).rejects.toThrow(
      "TRAINING_PLAN_OPEN_WORKOUT",
    );
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("fails closed if the unfinished-session check cannot be read", async () => {
    const db = database([ok(row), { data: null, error: { message: "Synthetic outage" } }]);
    await expect(activateValidatedTrainingPlan(db.client, USER, TRAINING_ID)).rejects.toThrow(
      /verify unfinished/,
    );
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it.each([
    { data: null, error: { message: "Synthetic RPC failure" } },
    { data: "different-id", error: null },
  ])("does not report activation success without the correct RPC result: %j", async (response) => {
    const db = database([ok(row), ok(null)], response);
    await expect(activateValidatedTrainingPlan(db.client, USER, TRAINING_ID)).rejects.toThrow(
      /confirm/,
    );
  });
});
