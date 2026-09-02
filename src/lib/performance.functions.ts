import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  aggregateExercisePerformance,
  getPerformanceOverviewData,
  getStrengthTrendData,
  getVolumeTrendData,
  loadCompletedPerformance,
} from "./performance.service";
import { calculateEstimated1RM } from "./performance.engine";

const ExerciseInput = z.object({ exerciseSlug: z.string().min(1) });

export const getPerformanceOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const data = await getPerformanceOverviewData(context.supabase, context.userId);

    return { status: "READY", metrics: data.metrics, exercises: data.exercises };
  });

export const getExerciseProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => ExerciseInput.parse(input))
  .handler(async ({ data, context }) => {
    const { sessions, logs } = await loadCompletedPerformance(context.supabase, context.userId);
    const performance = aggregateExercisePerformance(logs, data.exerciseSlug);
    const sessionIds = new Set(sessions.map((session) => session.id));
    const points = logs
      .filter((log) => log.exercise_slug === data.exerciseSlug && sessionIds.has(log.session_id))
      .map((log) => ({
        date: log.created_at,
        weightKg: log.weight_kg,
        reps: log.reps,
        rpe: log.rpe,
        estimated1RMKg: calculateEstimated1RM(log.weight_kg, log.reps),
      }));

    return {
      status: performance ? "READY" : "NO_DATA",
      performance,
      points,
    };
  });

export const getVolumeTrend = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => getVolumeTrendData(context.supabase, context.userId));

export const getStrengthTrend = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => getStrengthTrendData(context.supabase, context.userId));
