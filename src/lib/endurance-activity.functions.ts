import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ManualEnduranceActivitySchema } from "./endurance-activity.schema";
import { RetryEnduranceRaceSyncSchema } from "./endurance-race-sync.schema";

export const logEnduranceActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => ManualEnduranceActivitySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { recordEnduranceActivity } = await import("./endurance-activity.service");
    return recordEnduranceActivity(context.supabase, context.userId, data);
  });

/** Retry enrichment of an owned completed run; this endpoint never records a new activity. */
export const retryEnduranceRaceSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => RetryEnduranceRaceSyncSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { synchronizeEnduranceRace } = await import("./endurance-race-sync.service");
    return synchronizeEnduranceRace(context.supabase, context.userId, data);
  });
