import { ManualEnduranceSaveInputSchema } from "./endurance-submission.schema";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { RetryEnduranceRaceEnrichmentSchema } from "./endurance-race-enrichment.schema";

export const logEnduranceActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => ManualEnduranceSaveInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    if ("submissionId" in data && data.ownerId !== context.userId)
      throw new Error("ENDURANCE_SUBMISSION_IDENTITY_CHANGED");
    const { recordEnduranceActivity } = await import("./endurance-activity.service");
    return "submissionId" in data
      ? recordEnduranceActivity(context.supabase, context.userId, data.activity, data.submissionId)
      : recordEnduranceActivity(context.supabase, context.userId, data);
  });

/** Retry only secondary work for an existing, authenticated user's saved run. */
export const retryEnduranceRaceEnrichmentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => RetryEnduranceRaceEnrichmentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { retryEnduranceRaceEnrichment } = await import("./endurance-race-enrichment.service");
    return retryEnduranceRaceEnrichment(context.supabase, context.userId, data);
  });
