import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildUserContext } from "./user-context.server";

function avg(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

export const getUserIntelligence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [ctx, { data: workouts }, { data: checkins }, { data: metrics }] = await Promise.all([
      buildUserContext(context.supabase, context.userId),
      context.supabase
        .from("workout_sessions")
        .select("started_at, finished_at")
        .eq("user_id", context.userId)
        .not("finished_at", "is", null)
        .order("started_at", { ascending: false })
        .limit(100),
      context.supabase
        .from("daily_checkins")
        .select("readiness_score")
        .eq("user_id", context.userId)
        .order("checkin_on", { ascending: false })
        .limit(30),
      context.supabase
        .from("body_metrics")
        .select("weight_kg")
        .eq("user_id", context.userId)
        .order("measured_on", { ascending: false })
        .limit(30),
    ]);

    const now = Date.now();
    const workoutRows = workouts ?? [];
    const workouts7d = workoutRows.filter((x) => now - new Date(x.finished_at ?? x.started_at).getTime() <= 7 * 86400000).length;
    const workouts28d = workoutRows.filter((x) => now - new Date(x.finished_at ?? x.started_at).getTime() <= 28 * 86400000).length;
    const readiness = avg((checkins ?? []).map((x) => Number(x.readiness_score)).filter(Number.isFinite));
    const weights = (metrics ?? []).map((x) => Number(x.weight_kg)).filter(Number.isFinite);
    const weightDelta = weights.length >= 2 ? weights[0]! - weights[weights.length - 1]! : null;
    const lastWorkout = workoutRows[0]?.finished_at ?? workoutRows[0]?.started_at ?? null;

    const insights: Array<{
      id: string;
      insight_type: string;
      severity: "info" | "positive" | "attention";
      title: string;
      body: string;
      status: "new";
      created_at: string;
    }> = [];
    if (workouts28d >= 8) insights.push({ id: "consistency", insight_type: "consistency", severity: "positive", title: "Strong consistency", body: `You completed ${workouts28d} workouts in the last 28 days.`, status: "new", created_at: new Date().toISOString() });
    if (workouts7d === 0) insights.push({ id: "pause", insight_type: "consistency", severity: "attention", title: "Training pause detected", body: "No completed workout was recorded in the last 7 days.", status: "new", created_at: new Date().toISOString() });
    if (readiness !== null && readiness < 55) insights.push({ id: "recovery", insight_type: "recovery", severity: "attention", title: "Recovery needs attention", body: `Your recent average readiness is ${Math.round(readiness)}/100.`, status: "new", created_at: new Date().toISOString() });
    if (weightDelta !== null && Math.abs(weightDelta) >= 1) insights.push({ id: "body", insight_type: "body", severity: "info", title: "Body trend detected", body: `Your recorded weight changed by ${weightDelta > 0 ? "+" : ""}${weightDelta.toFixed(1)} kg across the available measurements.`, status: "new", created_at: new Date().toISOString() });

    return {
      context: ctx,
      metrics: { workouts7d, workouts28d, readiness, weightDelta, lastWorkout },
      insights,
    };
  });
