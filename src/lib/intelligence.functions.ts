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
    const [
      { data: workouts, error: workoutsError },
      { data: checkins, error: checkinsError },
      { data: metrics, error: metricsError },
    ] = await Promise.all([
      context.supabase
        .from("workout_sessions")
        .select("started_at")
        .eq("user_id", context.userId)
        .not("finished_at", "is", null)
        .order("started_at", { ascending: false })
        .limit(90),
      context.supabase
        .from("daily_checkins")
        .select("readiness_score")
        .eq("user_id", context.userId)
        .order("checkin_on", { ascending: false })
        .limit(14),
      context.supabase
        .from("body_metrics")
        .select("weight_kg")
        .eq("user_id", context.userId)
        .order("measured_on", { ascending: false })
        .limit(24),
    ]);
    if (workoutsError || checkinsError || metricsError) {
      throw new Error("Could not calculate user intelligence.");
    }

    const completedWorkouts = workouts ?? [];
    const recentCheckins = checkins ?? [];
    const bodyMetrics = metrics ?? [];

    const readiness = avg(
      recentCheckins.flatMap((checkin) =>
        checkin.readiness_score === null ? [] : [checkin.readiness_score],
      ),
    );
    const lastWorkout = completedWorkouts[0]?.started_at ?? null;
    const workouts7d = completedWorkouts.filter(
      (workout) => Date.now() - new Date(workout.started_at).getTime() <= 7 * 86_400_000,
    ).length;
    const workouts28d = completedWorkouts.filter(
      (workout) => Date.now() - new Date(workout.started_at).getTime() <= 28 * 86_400_000,
    ).length;
    const weights = bodyMetrics.flatMap((metric) =>
      metric.weight_kg === null ? [] : [metric.weight_kg],
    );
    const weightDelta = weights.length >= 2 ? weights[0]! - weights[weights.length - 1]! : null;

    const insights: Array<{
      type: string;
      severity: "info" | "positive" | "attention";
      title: string;
      body: string;
      fingerprint: string;
    }> = [];
    if (workouts28d >= 8)
      insights.push({
        type: "consistency",
        severity: "positive",
        title: "Strong consistency",
        body: `You completed ${workouts28d} workouts in the last 28 days.`,
        fingerprint: `consistency:${workouts28d >= 12 ? "high" : "good"}`,
      });
    if (workouts7d === 0)
      insights.push({
        type: "consistency",
        severity: "attention",
        title: "Training pause detected",
        body: "No completed workout was recorded in the last 7 days.",
        fingerprint: "consistency:no-workout-7d",
      });
    if (readiness !== null && readiness < 55)
      insights.push({
        type: "recovery",
        severity: "attention",
        title: "Recovery needs attention",
        body: `Your recent average readiness is ${Math.round(readiness)}/100.`,
        fingerprint: "recovery:low-readiness",
      });
    if (weightDelta !== null && Math.abs(weightDelta) >= 1)
      insights.push({
        type: "body",
        severity: "info",
        title: "Body trend detected",
        body: `Your recorded weight changed by ${weightDelta > 0 ? "+" : ""}${weightDelta.toFixed(1)} kg across the available measurements.`,
        fingerprint: "body:weight-trend",
      });

    for (const insight of insights) {
      const { error: upsertError } = await context.supabase.from("user_insights").upsert(
        {
          user_id: context.userId,
          insight_type: insight.type,
          severity: insight.severity,
          title: insight.title,
          body: insight.body,
          fingerprint: insight.fingerprint,
          source: { workouts7d, workouts28d, readiness, weightDelta },
          status: "new",
        },
        { onConflict: "user_id,fingerprint" },
      );
      if (upsertError) throw new Error("Could not save user intelligence.");
    }

    const { data: stored, error: storedError } = await context.supabase
      .from("user_insights")
      .select("id, insight_type, severity, title, body, status, created_at")
      .eq("user_id", context.userId)
      .neq("status", "dismissed")
      .order("created_at", { ascending: false })
      .limit(12);
    if (storedError) throw new Error("Could not load user intelligence.");

    return {
      context: ctx,
      metrics: { workouts7d, workouts28d, readiness, weightDelta, lastWorkout },
      insights: stored ?? [],
    };
  });
