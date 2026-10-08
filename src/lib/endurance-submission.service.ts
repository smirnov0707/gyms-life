import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import {
  EnduranceActivitySchema,
  ManualEnduranceActivitySchema,
  type EnduranceActivity,
} from "./endurance-activity.schema";
import { sameEnduranceActivity, type ManualEnduranceReceipt } from "./endurance-submission.schema";
import type { EnduranceTrainingCredit } from "./endurance-training-credit.engine";

type Client = SupabaseClient<Database>;
const persistedSubmission = z
  .object({
    version: z.literal(1),
    ownerId: z.string().uuid(),
    submissionId: z.string().uuid(),
    activity: ManualEnduranceActivitySchema,
  })
  .strict();

/**
 * A single logical manual save owns a stable workout UUID. PostgreSQL's existing
 * primary key arbitrates racing inserts. Never upsert: a repeated request must
 * not overwrite evidence, reopen a session or change an existing plan link.
 * No administrator client, new table, or second workout store is used.
 */
export async function persistEnduranceActivity(
  supabase: Client,
  userId: string,
  activity: EnduranceActivity,
  credit: EnduranceTrainingCredit,
  finishedAt: string,
  submissionId?: string,
) {
  const id = submissionId === undefined ? undefined : z.string().uuid().parse(submissionId);
  const submission =
    id === undefined
      ? null
      : persistedSubmission.parse({
          version: 1,
          ownerId: userId,
          submissionId: id,
          activity,
        });
  const receipt = (
    disposition: ManualEnduranceReceipt["disposition"],
  ): ManualEnduranceReceipt | null =>
    id === undefined ? null : { ownerId: userId, submissionId: id, disposition };

  const readExisting = async () => {
    if (id === undefined) return null;
    const { data, error } = await supabase
      .from("workout_sessions")
      .select(
        "id,user_id,started_at,finished_at,workout_snapshot,activity_kind,activity_environment,activity_source,duration_seconds,distance_meters,average_heart_rate_bpm,perceived_effort",
      )
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    // A failed read is not permission to try an unverified new insert.
    if (error) throw new Error("ENDURANCE_SUBMISSION_UNAVAILABLE");
    if (!data) return null;
    const execution = EnduranceActivitySchema.safeParse({
      kind: data.activity_kind,
      environment: data.activity_environment,
      source: data.activity_source,
      startedAt: data.started_at,
      durationSeconds: data.duration_seconds,
      distanceMeters: data.distance_meters,
      averageHeartRateBpm: data.average_heart_rate_bpm,
      perceivedEffort: data.perceived_effort,
    });
    const snapshot = z
      .object({ manualSubmission: persistedSubmission })
      .safeParse(data.workout_snapshot);
    if (
      !execution.success ||
      !sameEnduranceActivity(execution.data, activity) ||
      !snapshot.success ||
      data.id !== id ||
      data.user_id !== userId ||
      snapshot.data.manualSubmission.ownerId !== userId ||
      snapshot.data.manualSubmission.submissionId !== id ||
      !sameEnduranceActivity(snapshot.data.manualSubmission.activity, activity) ||
      Date.parse(data.started_at) !== Date.parse(activity.startedAt) ||
      data.finished_at === null ||
      Date.parse(data.finished_at) !== Date.parse(finishedAt)
    ) {
      // Do not disclose another workout's fields or conflate an unrelated unique conflict.
      throw new Error("ENDURANCE_SUBMISSION_CONFLICT");
    }
    return { id: data.id, started_at: data.started_at, finished_at: data.finished_at };
  };

  const existing = await readExisting();
  if (existing) return { session: existing, manualSubmission: receipt("replayed") };

  const { data, error } = await supabase
    .from("workout_sessions")
    .insert({
      ...(id === undefined ? {} : { id }),
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
      workout_snapshot: {
        enduranceCredit: credit,
        ...(submission ? { manualSubmission: submission } : {}),
      },
    })
    .select("id, started_at, finished_at")
    .single();

  if (error) {
    if (id !== undefined && error.code === "23505") {
      const winner = await readExisting();
      if (winner) return { session: winner, manualSubmission: receipt("replayed") };
      throw new Error("ENDURANCE_SUBMISSION_CONFLICT");
    }
    // An unknown transport result is retained by the client with the same ID.
    // Do not retry a write with a freshly generated UUID here.
    throw error;
  }
  if (!data || (id !== undefined && data.id !== id)) {
    throw new Error("ENDURANCE_SUBMISSION_UNAVAILABLE");
  }
  return { session: data, manualSubmission: receipt("created") };
}
