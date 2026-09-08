import { TrainingPlanDataSchema } from "@/lib/training-plan.schema";
import { getTodaysWorkout } from "./functions-stub";

/** Fixture-only query boundary: no URL, credentials or real database connection. */
type Result = { data: unknown; error: { message: string } | null };
type Builder = Record<string, unknown> & PromiseLike<Result>;
function queryBuilder(table: string) {
  let single = false;
  const result = async (): Promise<Result> => {
    const scenario = new URLSearchParams(window.location.search).get("scenario");
    if (scenario === "failure")
      return { data: null, error: { message: "Synthetic source read failure" } };
    if (scenario !== "reference") return { data: null, error: null };
    let data: unknown = null;
    if (table === "profiles") data = { id: "preview", display_name: "Alex Fixture" };
    if (table === "daily_checkins") data = { readiness_score: 72 };
    if (table === "plans") {
      const workout = await getTodaysWorkout();
      if (workout.status === "READY")
        data = {
          id: "fixture",
          lang: "en",
          data: TrainingPlanDataSchema.parse({
            title: "Build strength consistently",
            summary: "Synthetic programme for visual review",
            weeks: 6,
            progression: "Review recorded sets weekly",
            nutrition: "No nutrition prescription in this fixture",
            days: [workout.workout],
          }),
        };
    }
    if (table === "workout_sessions")
      data = [
        {
          id: "00000000-0000-4000-8000-000000000003",
          title: "Upper body focus",
          started_at: "2026-09-06T17:51:00.000Z",
          finished_at: "2026-09-06T18:40:00.000Z",
          total_volume: 10000,
          duration_seconds: 2940,
        },
      ];
    if (table === "set_logs")
      data = [
        { exercise_name: "Bench press", exercise_slug: "bench-press", weight_kg: 72, reps: 6 },
      ];
    return { data: Array.isArray(data) && single ? (data[0] ?? null) : data, error: null };
  };
  const builder = new Proxy({} as Builder, {
    get(_target, property) {
      if (property === "then")
        return (resolve: (value: Result) => unknown) => result().then(resolve);
      if (property === "single" || property === "maybeSingle")
        return () => {
          single = true;
          return builder;
        };
      return () => builder;
    },
  });
  return builder;
}
export const supabase = {
  from: queryBuilder,
  auth: {
    getSession: async () => ({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
  channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
  removeChannel: () => {},
};
