import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  BODY_METRIC_SELECT,
  normalizeManualBodyMetric,
  parseBodyMetric,
  parseBodyMetrics,
} from "./body-metric.schema";

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
    const measuredOn = new Date().toISOString().slice(0, 10);
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
