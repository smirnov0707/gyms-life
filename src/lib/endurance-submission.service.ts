import { createHash } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  ManualRunSubmissionSchema,
  manualRunEvidence,
  type ManualRunSubmission,
} from "./endurance-submission.schema";
import { buildEnduranceTrainingCredit } from "./endurance-training-credit.engine";
import {
  retryEnduranceRaceEnrichment,
  unavailableEnduranceEnrichment,
} from "./endurance-race-enrichment.service";

type Client = SupabaseClient<Database>;
// UUIDv5 namespace dedicated to manual-run request identities; not an access credential.
const namespace = Buffer.from("b02c60329c054b9ba8f7dc718c309571", "hex");
export function manualRunSessionId(ownerId: string, requestId: string): string {
  const hash = createHash("sha1")
    .update(namespace)
    .update(`${ownerId.toLowerCase()}:${requestId.toLowerCase()}`)
    .digest();
  hash.writeUInt8((hash.readUInt8(6) & 0x0f) | 0x50, 6);
  hash.writeUInt8((hash.readUInt8(8) & 0x3f) | 0x80, 8);
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
const fingerprint = (activity: ManualRunSubmission["activity"]) =>
  createHash("sha256").update(manualRunEvidence(activity)).digest("hex");
const columns =
  "id,user_id,started_at,finished_at,duration_seconds,activity_kind,activity_environment,activity_source,distance_meters,average_heart_rate_bpm,perceived_effort,workout_snapshot";
const StoredSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  started_at: z.string().datetime({ offset: true }),
  finished_at: z.string().datetime({ offset: true }),
  duration_seconds: z.number(),
  activity_kind: z.string(),
  activity_environment: z.string(),
  activity_source: z.string(),
  distance_meters: z.number().nullable(),
  average_heart_rate_bpm: z.number().nullable(),
  perceived_effort: z.number().nullable(),
  workout_snapshot: z.object({
    manualRunSubmission: z.object({
      version: z.literal(1),
      requestId: z.string().uuid(),
      fingerprint: z.string(),
    }),
  }),
});

/** Ordinary authenticated insert + immutable snapshot + existing PK. Never an upsert. */
export async function submitManualRun(
  supabase: Client,
  authenticatedOwner: string,
  input: unknown,
) {
  const request = ManualRunSubmissionSchema.parse(input);
  if (request.ownerId !== authenticatedOwner.toLowerCase())
    throw new Error("RUN_SUBMISSION_OWNER_CHANGED");
  const activity = request.activity;
  const id = manualRunSessionId(request.ownerId, request.requestId);
  const digest = fingerprint(activity);
  const finishedAt = new Date(
    Date.parse(activity.startedAt) + activity.durationSeconds * 1000,
  ).toISOString();
  const credit = buildEnduranceTrainingCredit(activity);
  if (credit.status !== "credited") throw new Error("RUN_SUBMISSION_INVALID");
  const sessionFrom = (value: unknown) => {
    const row = StoredSchema.safeParse(value);
    if (!row.success) throw new Error("RUN_SUBMISSION_CONFLICT");
    const saved = row.data;
    const evidence = ManualRunSubmissionSchema.shape.activity.safeParse({
      kind: saved.activity_kind,
      environment: saved.activity_environment,
      source: saved.activity_source,
      startedAt: saved.started_at,
      durationSeconds: saved.duration_seconds,
      distanceMeters: saved.distance_meters,
      averageHeartRateBpm: saved.average_heart_rate_bpm,
      perceivedEffort: saved.perceived_effort,
    });
    const marker = saved.workout_snapshot.manualRunSubmission;
    if (
      saved.id !== id ||
      saved.user_id.toLowerCase() !== request.ownerId ||
      marker.requestId !== request.requestId ||
      marker.fingerprint !== digest ||
      !evidence.success ||
      fingerprint(evidence.data) !== digest ||
      Date.parse(saved.finished_at) !== Date.parse(finishedAt)
    )
      throw new Error("RUN_SUBMISSION_CONFLICT");
    return { id: saved.id, started_at: saved.started_at, finished_at: saved.finished_at };
  };
  const read = async () => {
    const { data, error } = await supabase
      .from("workout_sessions")
      .select(columns)
      .eq("user_id", request.ownerId)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error("RUN_SUBMISSION_READ_UNAVAILABLE");
    return data === null ? null : sessionFrom(data);
  };
  let session = await read();
  let persistence: "created" | "replayed" = "replayed";
  if (!session) {
    if (Date.parse(finishedAt) > Date.now() + 5 * 60_000)
      throw new Error("RUN_SUBMISSION_IN_FUTURE");
    // Read-before-insert is an optimization, not the concurrency guarantee. Both
    // deliveries use the same PK, so a losing insert must prove the winning row.
    try {
      const { data, error } = await supabase
        .from("workout_sessions")
        .insert({
          id,
          user_id: request.ownerId,
          started_at: activity.startedAt,
          finished_at: finishedAt,
          duration_seconds: activity.durationSeconds,
          title: "Run",
          total_volume: 0,
          activity_kind: "run",
          activity_environment: activity.environment,
          activity_source: "manual",
          distance_meters: activity.distanceMeters,
          average_heart_rate_bpm: activity.averageHeartRateBpm,
          perceived_effort: activity.perceivedEffort,
          workout_snapshot: {
            enduranceCredit: credit,
            manualRunSubmission: {
              version: 1,
              requestId: request.requestId,
              fingerprint: digest,
            },
          },
        })
        .select(columns)
        .single();
      if (error || !data) throw new Error("RUN_SUBMISSION_INSERT_UNCONFIRMED");
      session = sessionFrom(data);
      persistence = "created";
    } catch {
      // The insert may have committed before its response was lost. A scoped,
      // exact-evidence read is the only success proof; never generate another ID.
      session = await read();
      if (!session) throw new Error("RUN_SUBMISSION_UNCONFIRMED");
    }
  }
  let enrichment;
  try {
    enrichment = await retryEnduranceRaceEnrichment(supabase, request.ownerId, {
      workoutSessionId: session.id,
    });
  } catch {
    enrichment = unavailableEnduranceEnrichment("load");
  }
  return {
    session,
    activity,
    credit,
    ...enrichment,
    submission: { ownerId: request.ownerId, requestId: request.requestId, persistence },
  };
}
