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
 * Server-owned audit records the index also carries, and which the generic
 * user-event timeline must never show.
 *
 * These are not things the athlete did. Hypothesis transitions are consumed by
 * the Lab ledger rather than presented as source evidence, and a nightly
 * recalculation is the system's own bookkeeping about when it last looked at
 * this athlete — real, worth recording, and not an event in their life.
 *
 * This is a list rather than a literal because every generic reader has to
 * exclude all of them. The three that existed each wrote
 * `.neq("event_type", "hypothesis_transition")` by hand, so the second audit
 * type would have leaked into the timeline, the Twin's evidence window and the
 * decision evidence behind them — three screens quietly reporting a background
 * job as something the athlete did.
 */
export const TIMELINE_AUDIT_EVENT_TYPES = [
  "hypothesis_transition",
  "twin_memory_change",
  "twin_memory_seen",
  "twin_memory_dismissed",
  "twin_recalculated",
] as const;

export const PersonalTimelineStoredEventTypeSchema = z.union([
  PersonalTimelineEventTypeSchema,
  z.enum(TIMELINE_AUDIT_EVENT_TYPES),
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
