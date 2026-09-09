// Synthetic in-memory Supabase adapter. No network or real account access.
import { state, count, persist } from "./state";
class Query {
  private filters: Record<string, unknown> = {};
  private start = 0;
  private end = Infinity;
  private single = false;
  private removing = false;
  delete() {
    this.removing = true;
    return this;
  }
  constructor(private table: string) {}
  select() {
    return this;
  }
  eq(key: string, value: unknown) {
    this.filters[key] = value;
    return this;
  }
  order() {
    return this;
  }
  limit(value: number) {
    this.end = value - 1;
    return this;
  }
  range(start: number, end: number) {
    this.start = start;
    this.end = end;
    return this;
  }
  maybeSingle() {
    this.single = true;
    return this;
  }
  then(resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) {
    return this.execute().then(resolve, reject);
  }
  private async execute() {
    count("read:" + this.table);
    const failed =
      (this.table === "nutrition_logs" && state.fail === "food") ||
      (this.table === "profiles" && state.fail === "profile") ||
      (this.table === "meal_plans" && state.fail === "meals");
    if (failed)
      return { data: null, error: { message: "Synthetic unavailable source" }, count: null };
    const rows =
      this.table === "profiles"
        ? [state.profile]
        : this.table === "meal_plans"
          ? state.meal
            ? [{ ...state.meal, ...state.meal.data }]
            : []
          : this.table === "plans"
            ? [
                {
                  id: "22222222-2222-4222-8222-222222222222",
                  user_id: state.profile.id,
                  title: state.plan.title,
                  weeks: 8,
                  days_per_week: 3,
                  created_at: "2026-09-09T12:00:00Z",
                  is_active: state.active,
                },
              ]
            : this.table === "nutrition_logs"
              ? state.foods
              : null;
    if (rows === null) throw new Error("Unexpected fixture table: " + this.table);
    const matches = rows.filter((row) =>
      Object.entries(this.filters).every(
        ([key, value]) => (row as unknown as Record<string, unknown>)[key] === value,
      ),
    );
    if (this.removing) {
      if (this.table !== "nutrition_logs")
        throw new Error("Only synthetic food rows may be removed");
      const ids = new Set(matches.map((row) => row.id));
      state.foods = state.foods.filter((row) => !ids.has(row.id));
      count("deleteFood");
      persist();
    }
    const selected = matches.slice(this.start, this.end + 1);
    return {
      data: this.single ? (selected[0] ?? null) : structuredClone(selected),
      error: null,
      count: matches.length,
    };
  }
}
export const supabase = { from: (table: string) => new Query(table) };
