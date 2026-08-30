import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildUserContext } from "./user-context.server";

function avg(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

/**
 * Deterministic first-pass intelligence. AI is used for interpretation later;
 * trend detection itself stays deterministic and auditable.
 */
export const getUserIntelligence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await buildUserContext(context.supabase, context.userId);
    const workouts = ctx.recentWorkouts;
    const checkins = ctx.recentCheckins;
    const metrics = ctx.recentBodyMetrics;

    const readiness = avg(checkins.map((x) => Number(x.readiness_score)).filter(Number.isFinite));
    const lastWorkout = workouts[0]?.started_at ?? null;
    const workouts7d = workouts.filter((x) => Date.now() - new Date(x.started_at).getTime() <= 7 * 86400000).length;
    const workouts28d = workouts.filter((x) => Date.now() - new Date(x.started_at).getTime() <= 28 * 86400000).length;
    const weights = metrics.map((x) => Number(x.weight_kg)).filter(Number.isFinite);
    const weightDelta = weights.length >= 2 ? weights[0]! - weights[weights.length - 1]! : null;

    const insights: Array<{ type: string; severity: "info" | "positive" | "attention"; title: string; body: string; fingerprint: string }> = [];
    if (workouts28d >= 8) insights.push({ type: "consistency", severity: "positive", title: "Strong consistency", body: `You completed ${workouts28d} workouts in the last 28 days.`, fingerprint: `consistency:${workouts28d >= 12 ? "high" : "good"}` });
    if (workouts7d === 0) insights.push({ type: "consistency", severity: "attention", title: "Training pause detected", body: "No completed workout was recorded in the last 7 days.", fingerprint: "consistency:no-workout-7d" });
    if (readiness !== null && readiness < 55) insights.push({ type: "recovery", severity: "attention", title: "Recovery needs attention", body: `Your recent average readiness is ${Math.round(readiness)}/100.`, fingerprint: "recovery:low-readiness" });
    if (weightDelta !== null && Math.abs(weightDelta) >= 1) insights.push({ type: "body", severity: "info", title: "Body trend detected", body: `Your recorded weight changed by ${weightDelta > 0 ? "+" : ""}${weightDelta.toFixed(1)} kg across the available measurements.`, fingerprint: "body:weight-trend" });

    for (const insight of insights) {
      await context.supabase.from("user_insights").upsert({
        user_id: context.userId,
        insight_type: insight.type,
        severity: insight.severity,
        title: insight.title,
        body: insight.body,
        fingerprint: insight.fingerprint,
        source: { workouts7d, workouts28d, readiness, weightDelta },
        status: "new",
      }, { onConflict: "user_id,fingerprint" });
    }

    const { data: stored } = await context.supabase
      .from("user_insights")
      .select("id, insight_type, severity, title, body, status, created_at")
      .eq("user_id", context.userId)
      .neq("status", "dismissed")
      .order("created_at", { ascending: false })
      .limit(12);

    return { context: ctx, metrics: { workouts7d, workouts28d, readiness, weightDelta, lastWorkout }, insights: stored ?? [] };
  });
