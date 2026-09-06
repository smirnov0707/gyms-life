import { z } from "zod";
import { IntelligenceProvenanceSchema } from "./intelligence-provenance.schema";

/**
 * User-visible canonical Future Lab timeline event types. Kept intentionally
 * small and session/day-level (never per-set) so the timeline stays a compact
 * index rather than a firehose of every micro-action.
 */
export const PersonalTimelineEventTypeSchema = z.enum([
  "workout_completed",
  "checkin_recorded",
  "decision_recorded",
]);

/**
 * The underlying timeline index may also carry server-owned audit records that
 * are intentionally excluded from the generic user-event timeline. Hypothesis
 * transitions are consumed by the Lab ledger, not presented as source evidence.
 */
export const PersonalTimelineStoredEventTypeSchema = z.union([
  PersonalTimelineEventTypeSchema,
  z.literal("hypothesis_transition"),
]);

/**
 * Timeline provenance uses the same Future Lab vocabulary as predictions,
 * wearable evidence and future normalized observations. "known" / "unknown"
 * describe epistemic state, not provenance, and therefore do not belong here.
 */
export const PersonalTimelineProvenanceSchema = IntelligenceProvenanceSchema;

/**
 * Timeline quality is intentionally separate from provenance. It describes
 * the evidentiary quality of a compact timeline summary, not where it came from.
 */
export const PersonalTimelineQualitySchema = z.enum(["unknown", "low", "moderate", "high"]);

export const PersonalTimelineEventInputSchema = z
  .object({
    eventType: PersonalTimelineStoredEventTypeSchema,
    occurredAt: z.string().datetime({ offset: true }),
    timeZone: z.string().trim().min(1).max(64).nullable(),
    provenance: PersonalTimelineProvenanceSchema,
    sourceSystem: z.literal("gymslife"),
    sourceTable: z.string().trim().min(1).max(64),
    sourceReference: z.string().trim().min(1).max(200),
    summary: z.record(z.string(), z.unknown()),
  })
  .strict();

export type PersonalTimelineEventInput = z.infer<typeof PersonalTimelineEventInputSchema>;
