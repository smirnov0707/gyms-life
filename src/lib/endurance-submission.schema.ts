import { z } from "zod";
import { ManualEnduranceActivitySchema } from "./endurance-activity.schema";

const uuid = z
  .string()
  .uuid()
  .transform((value) => value.toLowerCase());
/** An owner's original manual action, not a new timestamp on every delivery. */
export const ManualRunSubmissionSchema = z
  .object({
    ownerId: uuid,
    requestId: uuid,
    activity: ManualEnduranceActivitySchema.extend({
      kind: z.literal("run"),
      startedAt: z
        .string()
        .datetime({ offset: true })
        .transform((value) => new Date(value).toISOString()),
    }),
  })
  .strict();
export type ManualRunSubmission = z.infer<typeof ManualRunSubmissionSchema>;

export const ManualRunReceiptSchema = z
  .object({
    ownerId: uuid,
    requestId: uuid,
    persistence: z.enum(["created", "replayed"]),
  })
  .strict();

/** Defaults, field order and equivalent date offsets share one representation. */
export function manualRunEvidence(activity: ManualRunSubmission["activity"]): string {
  return JSON.stringify([
    activity.kind,
    activity.environment,
    activity.source,
    new Date(activity.startedAt).toISOString(),
    activity.durationSeconds,
    activity.distanceMeters,
    activity.averageHeartRateBpm,
    activity.perceivedEffort,
  ]);
}

export function acknowledgesManualRun(request: ManualRunSubmission, value: unknown): boolean {
  const reply = z
    .object({
      submission: ManualRunReceiptSchema,
      activity: ManualRunSubmissionSchema.shape.activity,
      session: z.object({
        id: uuid,
        started_at: z.string().datetime({ offset: true }),
        finished_at: z.string().datetime({ offset: true }),
      }),
    })
    .safeParse(value);
  return (
    reply.success &&
    reply.data.submission.ownerId === request.ownerId &&
    reply.data.submission.requestId === request.requestId &&
    manualRunEvidence(reply.data.activity) === manualRunEvidence(request.activity) &&
    Date.parse(reply.data.session.started_at) === Date.parse(request.activity.startedAt) &&
    Date.parse(reply.data.session.finished_at) ===
      Date.parse(request.activity.startedAt) + request.activity.durationSeconds * 1000
  );
}
