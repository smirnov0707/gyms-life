import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculateEstimated1RM } from "./performance.engine";
import { getPerformanceOverviewData, loadCompletedPerformance, aggregateExercisePerformance } from "./performance.service";

const ExerciseInput = z.object({ exerciseSlug: z.string().min(1) });

export const getPerformanceOverview = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const data = await getPerformanceOverviewData(context.supabase, context.userId);
  return { status: "READY" as const, metrics: data.metrics, exercises: data.exercises };
});

export const getExerciseProgress = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).validator((input: unknown) => ExerciseInput.parse(input)).handler(async ({ data, context }) => {
  const { sessions, logs } = await loadCompletedPerformance(context.supabase, context.userId);
  const performance = aggregateExercisePerformance(logs, data.exerciseSlug);
  const sessionIds = new Set(sessions.map((session) => session.id));
  const points = logs.filter((log) => log.exercise_slug === data.exerciseSlug && sessionIds.has(log.session_id)).map((log) => ({ date: log.created_at, weightKg: log.weight_kg, reps: log.reps, rpe: log.rpe, estimated1RMKg: calculateEstimated1RM(log.weight_kg, log.reps) }));
  return { status: performance ? "READY" as const : "NO_DATA" as const, performance, points };
});

export const getVolumeTrend = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { sessions } = await loadCompletedPerformance(context.supabase, context.userId);
  return { status: "READY" as const, points: sessions.map((session) => ({ date: session.finished_at!, workout: session.title, volume: Number((session.total_volume ?? 0).toFixed(1)), durationSeconds: session.duration_seconds ?? 0 })) };
});

export const getStrengthTrend = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { logs } = await loadCompletedPerformance(context.supabase, context.userId);
  const byExercise = new Map<string, { exerciseSlug: string; exerciseName: string; date: string; estimated1RMKg: number }[]>();
  for (const log of logs) {
    const e1rm = calculateEstimated1RM(log.weight_kg, log.reps);
    if (e1rm == null) continue;
    const current = byExercise.get(log.exercise_slug) ?? [];
    current.push({ exerciseSlug: log.exercise_slug, exerciseName: log.exercise_name, date: log.created_at, estimated1RMKg: e1rm });
    byExercise.set(log.exercise_slug, current);
  }
  return { status: "READY" as const, points: [...byExercise.values()].flatMap((points) => points.sort((a, b) => a.date.localeCompare(b.date)).slice(-20)) };
});
