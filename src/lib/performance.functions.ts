import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculateEstimated1RM, calculateVolume } from "./performance.engine";
import { loadCompletedPerformance } from "./performance.service";

const ExerciseInput = z.object({ exerciseSlug: z.string().min(1) });

export const getPerformanceOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const data = await getPerformanceOverviewData(context.supabase, context.userId);
    return { status: "READY" as const, metrics: data.metrics, exercises: data.exercises };
  });

export const getExerciseProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => ExerciseInput.parse(input))
  .handler(async ({ data, context }) => getExerciseProgressData(context.supabase, context.userId, data.exerciseSlug));

export const getVolumeTrend = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => getVolumeTrendData(context.supabase, context.userId));

export const getStrengthTrend = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => getStrengthTrendData(context.supabase, context.userId));

async function getPerformanceOverviewData(
  supabase: Parameters<typeof loadCompletedPerformance>[0],
  userId: string,
) {
  const { sessions, logs } = await loadCompletedPerformance(supabase, userId);
  const exercises = [...new Set(logs.map((log) => log.exercise_slug))].map((slug) => {
    const rows = logs.filter((log) => log.exercise_slug === slug && log.done);
    const weights = rows.map((row) => row.weight_kg).filter((value): value is number => value != null && value > 0);
    const reps = rows.map((row) => row.reps).filter((value): value is number => value != null && value > 0);
    const rpes = rows.map((row) => row.rpe).filter((value): value is number => value != null);
    const e1rms = rows.map((row) => calculateEstimated1RM(row.weight_kg, row.reps)).filter((value): value is number => value != null);
    const latest = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return {
      exerciseSlug: slug,
      exerciseName: latest?.exercise_name ?? slug,
      sessions: new Set(rows.map((row) => row.session_id)).size,
      totalSets: rows.length,
      totalReps: rows.reduce((sum, row) => sum + (row.reps ?? 0), 0),
      totalVolume: Number(rows.reduce((sum, row) => sum + calculateVolume(row.reps, row.weight_kg), 0).toFixed(1)),
      bestWeightKg: weights.length ? Math.max(...weights) : null,
      bestReps: reps.length ? Math.max(...reps) : null,
      bestEstimated1RMKg: e1rms.length ? Math.max(...e1rms) : null,
      averageRpe: rpes.length ? Number((rpes.reduce((a, b) => a + b, 0) / rpes.length).toFixed(1)) : null,
      latest: latest
        ? {
            date: latest.created_at,
            weightKg: latest.weight_kg,
            reps: latest.reps,
            rpe: latest.rpe,
            estimated1RMKg: calculateEstimated1RM(latest.weight_kg, latest.reps),
          }
        : null,
    };
  });
  const rpes = logs.map((log) => log.rpe).filter((value): value is number => value != null);
  return {
    sessions,
    logs,
    metrics: {
      workouts: sessions.length,
      totalVolume: Number(sessions.reduce((sum, session) => sum + (session.total_volume ?? 0), 0).toFixed(1)),
      totalDurationSeconds: sessions.reduce((sum, session) => sum + (session.duration_seconds ?? 0), 0),
      totalSets: logs.length,
      totalReps: logs.reduce((sum, log) => sum + (log.reps ?? 0), 0),
      averageRpe: rpes.length ? Number((rpes.reduce((a, b) => a + b, 0) / rpes.length).toFixed(1)) : null,
    },
    exercises,
  };
}

async function getExerciseProgressData(
  supabase: Parameters<typeof loadCompletedPerformance>[0],
  userId: string,
  exerciseSlug: string,
) {
  const { logs } = await loadCompletedPerformance(supabase, userId);
  return {
    exerciseSlug,
    points: logs
      .filter((log) => log.exercise_slug === exerciseSlug && log.done)
      .map((log) => ({
        date: log.created_at,
        weightKg: log.weight_kg,
        reps: log.reps,
        rpe: log.rpe,
        estimated1RMKg: calculateEstimated1RM(log.weight_kg, log.reps),
      })),
  };
}

async function getVolumeTrendData(
  supabase: Parameters<typeof loadCompletedPerformance>[0],
  userId: string,
) {
  const { sessions } = await loadCompletedPerformance(supabase, userId);
  return {
    points: sessions.map((session) => ({
      date: session.finished_at ?? session.started_at,
      workout: session.title,
      volume: Number(session.total_volume ?? 0),
    })),
  };
}

async function getStrengthTrendData(
  supabase: Parameters<typeof loadCompletedPerformance>[0],
  userId: string,
) {
  const { logs } = await loadCompletedPerformance(supabase, userId);
  return {
    points: logs
      .filter((log) => log.done && log.weight_kg != null && log.reps != null)
      .map((log) => ({
        date: log.created_at,
        exerciseSlug: log.exercise_slug,
        exerciseName: log.exercise_name,
        estimated1RMKg: calculateEstimated1RM(log.weight_kg, log.reps) ?? 0,
      })),
  };
}
