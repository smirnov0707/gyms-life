import { state } from "./state";
import { browserTimeZone, dayInTimeZone } from "../../src/lib/local-day";

/** Synthetic rows exercise the real read and model, never a production account. */
export function riskFixtureRows(table: string, scenario: string): Record<string, unknown>[] {
  if (scenario === "empty") return [];
  const date = (days: number) => new Date(Date.now() - days * 86400000).toISOString();
  const owner = state.profile.id;
  let rows: Record<string, unknown>[] = [];
  if (scenario === "unmeasured") {
    if (table === "set_logs")
      rows = [
        {
          user_id: owner,
          performed_at: date(1),
          exercise_slug: "unknown",
          exercise_name: "Synthetic unmeasured movement",
          weight_kg: null,
          reps: null,
        },
      ];
    return rows;
  }
  if (scenario === "partial") {
    return table === "workout_sessions"
      ? [{ user_id: owner, started_at: date(1), total_volume: null }]
      : [];
  }
  const low = scenario === "low";
  if (table === "set_logs") {
    const days = low ? [24, 17, 10, 3] : [24, 17, 10, 6, 4, 2, 1];
    rows = days.flatMap((day) =>
      ["press", "row"].map((movement) => ({
        user_id: owner,
        performed_at: date(day),
        exercise_slug: movement,
        exercise_name:
          movement === "press" ? "Synthetic long-name training press" : "Synthetic row",
        weight_kg: !low && day < 7 ? 75 : 50,
        reps: 10,
      })),
    );
    rows.push({
      user_id: owner,
      performed_at: date(100),
      exercise_slug: "press",
      exercise_name: "EXCLUDED_OLD_RECORD",
      weight_kg: 99999,
      reps: 999,
    });
  } else if (table === "workout_sessions") {
    rows = (low ? [1, 4, 7] : [1, 2, 3, 4]).map((day) => ({
      user_id: owner,
      started_at: date(day),
      total_volume: 1000,
    }));
  } else if (table === "daily_checkins") {
    rows = [1, 2, 3].map((day) => ({
      user_id: owner,
      checkin_on: dayInTimeZone(new Date(date(day)), browserTimeZone()),
      soreness: 1,
      readiness_score: 80,
    }));
  }
  if (rows[0])
    rows.push({
      ...rows[0],
      user_id: "another-user",
      exercise_name: "EXCLUDED_OTHER_OWNER",
      weight_kg: 99999,
      reps: 999,
      soreness: 5,
      readiness_score: 0,
    });
  return rows;
}
