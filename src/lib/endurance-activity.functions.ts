import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ManualRunSubmissionSchema } from "./endurance-submission.schema";
import { ManualEnduranceActivitySchema } from "./endurance-activity.schema";
import { RetryEnduranceRaceEnrichmentSchema } from "./endurance-race-enrichment.schema";

export const logEnduranceActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    ManualRunSubmissionSchema.or(ManualEnduranceActivitySchema).parse(input),
  )
  .handler(async ({ data, context }) => {
    if ("requestId" in data) {
      const { submitManualRun } = await import("./endurance-submission.service");
      return submitManualRun(context.supabase, context.userId, data);
    }
    // Preserve the legacy action contract for already-loaded clients. New
    // QuickRunLog always sends the retained envelope; it never falls back here.
    const { recordEnduranceActivity } = await import("./endurance-activity.service");
    return {
      ...(await recordEnduranceActivity(context.supabase, context.userId, data)),
      submission: null,
    };
  });

/** Retry only secondary work for an existing, authenticated user's saved run. */
export const retryEnduranceRaceEnrichmentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => RetryEnduranceRaceEnrichmentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { retryEnduranceRaceEnrichment } = await import("./endurance-race-enrichment.service");
    return retryEnduranceRaceEnrichment(context.supabase, context.userId, data);
  });
