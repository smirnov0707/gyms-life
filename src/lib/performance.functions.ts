import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  getPerformanceOverviewData,
  getStrengthTrendData,
  getVolumeTrendData,
} from "./performance.service";

export const getPerformanceOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const data = await getPerformanceOverviewData(context.supabase, context.userId);

    return { status: "READY", metrics: data.metrics, exercises: data.exercises };
  });

export const getVolumeTrend = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => getVolumeTrendData(context.supabase, context.userId));

export const getStrengthTrend = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => getStrengthTrendData(context.supabase, context.userId));
