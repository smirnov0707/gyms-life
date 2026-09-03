import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ForecastInputSchema = z.object({}).strict();

/**
 * Returns a deterministic estimate from the authenticated user's completed
 * set logs. It has no AI provider dependency and cannot prescribe a load.
 */
export const forecastProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => ForecastInputSchema.parse(input ?? {}))
  .handler(async ({ context }) => {
    const { loadDeterministicPerformanceForecast } = await import("./forecast.server");
    return loadDeterministicPerformanceForecast(context.supabase, context.userId);
  });
