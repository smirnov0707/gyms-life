import { z } from "zod";
import { ManualEnduranceActivitySchema, type EnduranceActivity } from "./endurance-activity.schema";

/** The caller's identity is checked against authentication, never used as authorization. */
export const ManualEnduranceSubmissionSchema = z
  .object({
    ownerId: z.string().uuid(),
    submissionId: z.string().uuid(),
    activity: ManualEnduranceActivitySchema,
  })
  .strict();
export type ManualEnduranceSubmission = z.infer<typeof ManualEnduranceSubmissionSchema>;

export const ManualEnduranceReceiptSchema = z
  .object({
    ownerId: z.string().uuid(),
    submissionId: z.string().uuid(),
    disposition: z.enum(["created", "replayed"]),
  })
  .strict();
export type ManualEnduranceReceipt = z.infer<typeof ManualEnduranceReceiptSchema>;

/** UTC offsets and property ordering must not turn the same execution into a new one. */
export function sameEnduranceActivity(a: EnduranceActivity, b: EnduranceActivity): boolean {
  return (
    a.kind === b.kind &&
    a.environment === b.environment &&
    a.source === b.source &&
    Date.parse(a.startedAt) === Date.parse(b.startedAt) &&
    a.durationSeconds === b.durationSeconds &&
    a.distanceMeters === b.distanceMeters &&
    a.averageHeartRateBpm === b.averageHeartRateBpm &&
    a.perceivedEffort === b.perceivedEffort
  );
}

export function isManualEnduranceAcknowledgement(
  submission: ManualEnduranceSubmission,
  value: unknown,
): boolean {
  const parsed = z
    .object({
      manualSubmission: ManualEnduranceReceiptSchema,
      session: z.object({ id: z.string().uuid() }),
      activity: ManualEnduranceActivitySchema,
    })
    .safeParse(value);
  return (
    parsed.success &&
    parsed.data.manualSubmission.ownerId === submission.ownerId &&
    parsed.data.manualSubmission.submissionId === submission.submissionId &&
    parsed.data.session.id === submission.submissionId &&
    sameEnduranceActivity(parsed.data.activity, submission.activity)
  );
}

/** Strict alternatives keep existing clients working without downgrading a malformed envelope. */
export const ManualEnduranceSaveInputSchema = z.union([
  ManualEnduranceSubmissionSchema,
  ManualEnduranceActivitySchema,
]);
