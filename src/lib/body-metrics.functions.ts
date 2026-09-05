import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  BODY_METRIC_SELECT,
  normalizeManualBodyMetric,
  parseBodyMetric,
  parseBodyMetrics,
} from "./body-metric.schema";
import { athleteDay } from "./athlete-day.server";

export const getBodyMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rawMetrics, error } = await context.supabase
      .from("body_metrics")
      .select(BODY_METRIC_SELECT)
      .eq("user_id", context.userId)
      .order("measured_on", { ascending: true });

    if (error) {
      throw new Error(`Body metrics lookup failed: ${error.message}`);
    }

    return { metrics: parseBodyMetrics(rawMetrics ?? []) };
  });

export const recordManualBodyMetric = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => normalizeManualBodyMetric(input))
  .handler(async ({ data, context }) => {
    // The UTC date is yesterday for anyone east of Greenwich in their small
    // hours, and this upserts on (user_id, measured_on): a 01:00 weigh-in in
    // Vilnius did not add today's reading, it overwrote yesterday's.
    const measuredOn = await athleteDay(context.supabase, context.userId);
    const { data: rawMetric, error } = await context.supabase
      .from("body_metrics")
      .upsert(
        {
          user_id: context.userId,
          measured_on: measuredOn,
          ...(data.weight_kg !== undefined ? { weight_kg: data.weight_kg } : {}),
          ...(data.body_fat !== undefined ? { body_fat: data.body_fat } : {}),
        },
        { onConflict: "user_id,measured_on" },
      )
      .select(BODY_METRIC_SELECT)
      .single();

    if (error || !rawMetric) {
      throw new Error(`Could not record body metric: ${error?.message ?? "no record returned"}`);
    }

    return { metric: parseBodyMetric(rawMetric) };
  });
