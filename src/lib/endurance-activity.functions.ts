import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ManualEnduranceActivitySchema } from "./endurance-activity.schema";
import { RetryEnduranceRaceEnrichmentSchema } from "./endurance-race-enrichment.schema";

export const logEnduranceActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => ManualEnduranceActivitySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { recordEnduranceActivity } = await import("./endurance-activity.service");
    return recordEnduranceActivity(context.supabase, context.userId, data);
  });

/** Retry only secondary work for an existing, authenticated user's saved run. */
export const retryEnduranceRaceEnrichmentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => RetryEnduranceRaceEnrichmentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { retryEnduranceRaceEnrichment } = await import("./endurance-race-enrichment.service");
    return retryEnduranceRaceEnrichment(context.supabase, context.userId, data);
  });
