import { persistEnduranceActivity } from "./endurance-submission.service";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { EnduranceActivitySchema, type EnduranceActivity } from "./endurance-activity.schema";
import { buildEnduranceTrainingCredit } from "./endurance-training-credit.engine";
import {
  retryEnduranceRaceEnrichment,
  unavailableEnduranceEnrichment,
  type EnduranceRaceEnrichmentResult,
} from "./endurance-race-enrichment.service";

type Client = SupabaseClient<Database>;

export async function recordEnduranceActivity(
  supabase: Client,
  userId: string,
  input: unknown,
  submissionId?: string,
) {
  const activity = EnduranceActivitySchema.parse(input);
  const credit = buildEnduranceTrainingCredit(activity);
  if (credit.status !== "credited") throw new Error("Endurance activity could not be credited.");

  const startedMs = new Date(activity.startedAt).getTime();
  const finishedMs = startedMs + activity.durationSeconds * 1000;
  if (finishedMs > Date.now() + 5 * 60_000) {
    throw new Error("Completed endurance activity cannot finish in the future.");
  }
  const finishedAt = new Date(finishedMs).toISOString();

  const { session: data, manualSubmission } = await persistEnduranceActivity(
    supabase,
    userId,
    activity,
    credit,
    finishedAt,
    submissionId,
  );

  let enrichment: EnduranceRaceEnrichmentResult = {
    raceMatch: null,
    raceIntelligence: null,
    raceEnrichment: { status: "not_applicable", linked: false, retryable: false },
  };
  if (activity.kind === "run") {
    try {
      enrichment = await retryEnduranceRaceEnrichment(supabase, userId, {
        workoutSessionId: data.id,
      });
    } catch {
      // The primary insert succeeded. Never suggest saving the same run again
      // just because its optional plan linkage/readback is unavailable.
      enrichment = unavailableEnduranceEnrichment("load");
    }
  }

  return {
    session: data,
    manualSubmission,
    activity: activity satisfies EnduranceActivity,
    credit,
    ...enrichment,
  };
}
