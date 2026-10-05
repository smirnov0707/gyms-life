import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { EnduranceActivitySchema, type EnduranceActivity } from "./endurance-activity.schema";
import { buildEnduranceTrainingCredit } from "./endurance-training-credit.engine";

type Client = SupabaseClient<Database>;

export async function recordEnduranceActivity(
  supabase: Client,
  userId: string,
  input: unknown,
) {
  const activity = EnduranceActivitySchema.parse(input);
  const credit = buildEnduranceTrainingCredit(activity);
  if (credit.status !== "credited") throw new Error("Endurance activity could not be credited.");

  const finishedAt = new Date(
    new Date(activity.startedAt).getTime() + activity.durationSeconds * 1000,
  ).toISOString();

  const { data, error } = await supabase
    .from("workout_sessions")
    .insert({
      user_id: userId,
      started_at: activity.startedAt,
      finished_at: finishedAt,
      duration_seconds: activity.durationSeconds,
      title: activity.kind === "run" ? "Run" : activity.kind === "walk" ? "Walk" : "Hike",
      total_volume: 0,
      activity_kind: activity.kind,
      activity_environment: activity.environment,
      activity_source: activity.source,
      distance_meters: activity.distanceMeters,
      average_heart_rate_bpm: activity.averageHeartRateBpm,
      perceived_effort: activity.perceivedEffort,
      workout_snapshot: { enduranceCredit: credit },
    })
    .select("id, started_at, finished_at")
    .single();

  if (error) throw error;
  return { session: data, activity: activity satisfies EnduranceActivity, credit };
}
