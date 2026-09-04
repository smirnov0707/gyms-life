import { z } from "zod";

/**
 * Canonical Future Lab timeline event types. Kept intentionally small and
 * session/day-level (never per-set) so the timeline stays a compact index
 * rather than a firehose of every micro-action.
 */
export const PersonalTimelineEventTypeSchema = z.enum([
  "workout_completed",
  "checkin_recorded",
  "decision_recorded",
]);

/** Matches the `personal_timeline_provenance` check constraint exactly. */
export const PersonalTimelineProvenanceSchema = z.enum([
  "known",
  "measured",
  "user_reported",
  "device_reported",
  "calculated",
  "inferred",
  "predicted",
  "simulated",
  "unknown",
]);

/** Matches the `personal_timeline_quality` check constraint exactly. */
export const PersonalTimelineQualitySchema = z.enum(["unknown", "low", "moderate", "high"]);

export const PersonalTimelineEventInputSchema = z
  .object({
    eventType: PersonalTimelineEventTypeSchema,
    occurredAt: z.string().min(1),
    timeZone: z.string().trim().min(1).max(64).nullable(),
    provenance: PersonalTimelineProvenanceSchema,
    sourceSystem: z.literal("gymslife"),
    sourceTable: z.string().trim().min(1).max(64),
    sourceReference: z.string().trim().min(1).max(200),
    summary: z.record(z.string(), z.unknown()),
  })
  .strict();

export type PersonalTimelineEventInput = z.infer<typeof PersonalTimelineEventInputSchema>;
