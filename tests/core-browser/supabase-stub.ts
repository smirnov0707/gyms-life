// Synthetic in-memory Supabase adapter. No network or real account access.
import { state, count, persist, delay } from "./state";
import { exercises } from "./fixtures";
import { riskFixtureRows } from "./risk-fixtures";
class Query {
  private filters: Record<string, unknown> = {};
  private lowerBounds: Record<string, unknown> = {};
  gte(key: string, value: unknown) {
    this.lowerBounds[key] = value;
    return this;
  }
  private start = 0;
  private end = Infinity;
  private single = false;
  private nonNull: string[] = [];
  not(key: string, operator: string, value: unknown) {
    if (operator !== "is" || value !== null) throw new Error("Unexpected synthetic not filter");
    this.nonNull.push(key);
    return this;
  }
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
  private ordering: { key: string; ascending: boolean }[] = [];
  order(key: string, options: { ascending?: boolean } = {}) {
    this.ordering.push({ key, ascending: options.ascending ?? true });
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
    const params = new URLSearchParams(location.search);
    if (
      (params.get("screen") === "risk" || params.get("risk") === "ready") &&
      ["set_logs", "workout_sessions", "daily_checkins"].includes(this.table)
    ) {
      state.last["riskRead:" + this.table] = {
        filters: this.filters,
        lowerBounds: this.lowerBounds,
        ordering: this.ordering,
        limit: this.end + 1,
      };
      while (state.fail === "risk-pending") await delay();
      if (state.fail === "risk" || state.fail === "risk-" + this.table)
        return { data: null, error: { message: "UNTRUSTED_SYNTHETIC_RISK_FAILURE" } };
      const records = riskFixtureRows(this.table, params.get("scenario") ?? "ready").filter(
        (row) =>
          Object.entries(this.filters).every(([key, value]) => row[key] === value) &&
          Object.entries(this.lowerBounds).every(
            ([key, value]) =>
              typeof row[key] === "string" && typeof value === "string" && row[key] >= value,
          ),
      );
      for (const { key, ascending } of [...this.ordering].reverse())
        records.sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (ascending ? 1 : -1));
      return { data: records.slice(this.start, this.end + 1), error: null };
    }
    if (
      new URLSearchParams(location.search).get("screen") === "future" &&
      ["set_logs", "workout_sessions", "daily_checkins"].includes(this.table)
    ) {
      state.last["futureRead:" + this.table] = {
        filters: this.filters,
        lowerBounds: this.lowerBounds,
      };
      return { data: [], error: null };
    }
    if (
      new URLSearchParams(location.search).get("screen") === "milestones" &&
      ["workout_sessions", "form_analyses", "daily_checkins"].includes(this.table)
    ) {
      state.last["ledgerRead:" + this.table] = { filters: this.filters, nonNull: this.nonNull };
      while (state.fail === "milestones-pending") await delay();
      if (state.fail === "milestones" || state.fail === "milestones-" + this.table)
        return { data: null, error: { message: "Synthetic ledger unavailable" } };
      if (new URLSearchParams(location.search).get("scenario") === "empty")
        return { data: [], error: null };
      const days = Array.from({ length: 10 }, (_, i) =>
        new Date(Date.now() - i * 86400000).toISOString(),
      );
      const records: Record<string, unknown>[] =
        this.table === "workout_sessions"
          ? [
              ...days.map((started_at) => ({
                user_id: state.profile.id,
                started_at,
                finished_at: started_at,
                total_volume: 6500,
              })),
              {
                user_id: state.profile.id,
                started_at: days[0],
                finished_at: null,
                total_volume: 990000,
              },
            ]
          : this.table === "form_analyses"
            ? [{ user_id: state.profile.id, score: 92 }]
            : days
                .slice(0, 7)
                .map((date) => ({ user_id: state.profile.id, checkin_on: date.slice(0, 10) }));
      records.push({
        user_id: "another-user",
        started_at: days[0],
        finished_at: days[0],
        total_volume: 999999,
        score: 100,
        checkin_on: days[0],
      });
      return {
        data: records.filter(
          (row) =>
            Object.entries(this.filters).every(([key, value]) => row[key] === value) &&
            this.nonNull.every((key) => row[key] != null),
        ),
        error: null,
      };
    }
    if (this.table === "daily_checkins") {
      state.last["read:daily_checkins"] = { ...this.filters };
      while (state.fail === "readiness-pending") await delay();
    }
    if (this.table === "exercises") while (state.fail === "exercises-pending") await delay();
    const failed =
      (this.table === "exercises" && state.fail === "exercises") ||
      (this.table === "daily_checkins" && state.fail === "readiness") ||
      (this.table === "nutrition_logs" && state.fail === "food") ||
      (this.table === "profiles" && state.fail === "profile") ||
      (this.table === "meal_plans" && state.fail === "meals");
    if (failed)
      return { data: null, error: { message: "Synthetic unavailable source" }, count: null };
    const rows =
      this.table === "form_analyses"
        ? []
        : this.table === "exercises"
          ? exercises
          : this.table === "daily_checkins"
            ? state.checkin
              ? [state.checkin]
              : []
            : this.table === "profiles"
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
