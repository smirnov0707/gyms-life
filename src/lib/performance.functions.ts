import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  getExerciseProgressData,
  getPerformanceOverviewData,
  getStrengthTrendData,
  getVolumeTrendData,
} from "./performance.service";

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
  .handler(async ({ data, context }) => {
    return getExerciseProgressData(context.supabase, context.userId, data.exerciseSlug);
  });

export const getVolumeTrend = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return getVolumeTrendData(context.supabase, context.userId);
  });

export const getStrengthTrend = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return getStrengthTrendData(context.supabase, context.userId);
  });
