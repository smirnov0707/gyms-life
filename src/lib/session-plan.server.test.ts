import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { WorkoutSession } from "./workout-session.schema";
import { loadSessionPlannedDay } from "./session-plan.server";
import { USER, TRAINING_ID, trainingPlan } from "../../tests/core-browser/fixtures";
type Source = Pick<
  WorkoutSession,
  "dayIndex" | "adaptationModifier" | "workoutSnapshot" | "planId"
>;
const day = trainingPlan.days[0]!;
const legacy: Source = {
  dayIndex: 0,
  adaptationModifier: 1,
  workoutSnapshot: null,
  planId: TRAINING_ID,
};
const snapshot: Source = {
  ...legacy,
  workoutSnapshot: {
    version: "1.0",
    workout: day,
    adaptation: {
      version: "1.0",
      readinessModifier: 1,
      reasons: [],
      sourceContextIds: [],
      timeBudgetMinutes: null,
      substitutions: [],
      omittedExerciseSlugs: [],
    },
  },
};
function client(result: { data: unknown; error: unknown }) {
  const calls: Array<[string, unknown[]]> = [];
  const from = vi.fn(() => {
    const promise = Promise.resolve(result);
    const query = new Proxy(
      {},
      {
        get: (_object, key) =>
          key === "then"
            ? promise.then.bind(promise)
            : (...args: unknown[]) => {
                calls.push([String(key), args]);
                return query;
              },
      },
    );
    return query;
  });
  return { db: { from } as unknown as SupabaseClient<Database>, from, calls };
}
describe("immutable workout session resolution", () => {
  it("needs no active-programme query when the workout has its saved execution snapshot", async () => {
    const db = client({ data: null, error: { message: "Plan service offline" } });
    expect(await loadSessionPlannedDay(db.db, USER, snapshot)).toEqual(day);
    expect(db.from).not.toHaveBeenCalled();
  });
  it("keeps an authorized saved snapshot after its linked old plan is gone", async () => {
    const db = client({ data: null, error: null });
    expect(await loadSessionPlannedDay(db.db, USER, { ...snapshot, planId: null })).toEqual(day);
    expect(db.from).not.toHaveBeenCalled();
  });
  it("reads the owner-scoped session programme, not the newly active programme, for legacy sessions", async () => {
    const db = client({ data: { data: trainingPlan }, error: null });
    expect(await loadSessionPlannedDay(db.db, USER, legacy)).toEqual(day);
    expect(db.calls).toContainEqual(["eq", ["id", TRAINING_ID]]);
    expect(db.calls).toContainEqual(["eq", ["user_id", USER]]);
    expect(db.calls).not.toContainEqual(["eq", ["is_active", true]]);
  });
  it("rejects an unreadable legacy programme instead of inventing a day", async () => {
    const db = client({ data: null, error: { message: "outage" } });
    await expect(loadSessionPlannedDay(db.db, USER, legacy)).rejects.toThrow(/could not be read/);
  });
  it("rejects invalid legacy programme data", async () => {
    const db = client({ data: { data: {} }, error: null });
    await expect(loadSessionPlannedDay(db.db, USER, legacy)).rejects.toThrow(/invalid/);
  });
  it("does not replace a mismatched saved day with today's active day", async () => {
    const db = client({ data: { data: trainingPlan }, error: null });
    expect(await loadSessionPlannedDay(db.db, USER, { ...snapshot, dayIndex: 6 })).toBeNull();
    expect(db.from).not.toHaveBeenCalled();
  });
});
