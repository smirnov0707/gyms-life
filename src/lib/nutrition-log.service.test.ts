import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { readDailyNutritionLogs } from "./nutrition-log.service";
import { USER } from "../../tests/core-browser/fixtures";
const DAY = "2026-09-09";
const row = (id: number) => ({
  id: String(id),
  user_id: USER,
  logged_on: DAY,
  created_at: `2026-09-09T10:00:00Z`,
  description: "Synthetic meal",
  food_name: "Test",
  calories: 10,
  protein: 1,
  carbs: 1,
  fat: 1,
  note: null,
  source: "text_estimate",
});
function client(responses: Array<{ data: unknown; error: unknown; count: number | null }>) {
  const calls: Array<[string, unknown[]]> = [];
  const from = vi.fn((table: string) => {
    expect(table).toBe("nutrition_logs");
    const answer = responses.shift();
    if (!answer) throw new Error("Unexpected query");
    const query = new Proxy(
      {},
      {
        get: (_target, key) =>
          key === "then"
            ? Promise.resolve(answer).then.bind(Promise.resolve(answer))
            : (...args: unknown[]) => {
                calls.push([String(key), args]);
                return query;
              },
      },
    );
    return query;
  });
  return { supabase: { from } as unknown as SupabaseClient<Database>, calls, from };
}
describe("complete local-day nutrition reads", () => {
  it("returns a confirmed empty day rather than guessing on missing data", async () => {
    const db = client([{ data: [], error: null, count: 0 }]);
    expect(await readDailyNutritionLogs(db.supabase, USER, DAY)).toEqual([]);
    expect(db.calls).toContainEqual(["eq", ["user_id", USER]]);
    expect(db.calls).toContainEqual(["eq", ["logged_on", DAY]]);
  });
  it("loads all pages instead of silently truncating today's calories at 80 entries", async () => {
    const db = client([
      { data: Array.from({ length: 250 }, (_, i) => row(i)), error: null, count: 251 },
      { data: [row(250)], error: null, count: 251 },
    ]);
    const rows = await readDailyNutritionLogs(db.supabase, USER, DAY);
    expect(rows).toHaveLength(251);
    expect(rows.reduce((sum, r) => sum + r.calories, 0)).toBe(2510);
    expect(db.calls).toContainEqual(["range", [250, 499]]);
  });
  it.each([
    { data: null, error: null, count: 0 },
    { data: [], error: { message: "failed" }, count: 0 },
    { data: [], error: null, count: null },
    { data: [row(1)], error: null, count: 2 },
    { data: [{ ...row(1), calories: NaN }], error: null, count: 1 },
    { data: [{ ...row(1), user_id: "another" }], error: null, count: 1 },
  ])("rejects unavailable/incomplete/inconsistent log %j", async (response) => {
    const db = client([response]);
    await expect(readDailyNutritionLogs(db.supabase, USER, DAY)).rejects.toThrow();
  });
  it("refuses a count change between pages instead of returning partial daily intake", async () => {
    const db = client([
      { data: Array.from({ length: 250 }, (_, i) => row(i)), error: null, count: 251 },
      { data: [row(250)], error: null, count: 252 },
    ]);
    await expect(readDailyNutritionLogs(db.supabase, USER, DAY)).rejects.toThrow(/changed/);
  });
  it("validates the day before querying", async () => {
    const db = client([]);
    await expect(readDailyNutritionLogs(db.supabase, USER, "2026-02-31")).rejects.toThrow();
    expect(db.from).not.toHaveBeenCalled();
  });
});
