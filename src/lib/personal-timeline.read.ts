import { z } from "zod";
import { IanaTimeZoneSchema } from "./local-day";
import {
  PersonalTimelineEventTypeSchema,
  PersonalTimelineProvenanceSchema,
  PersonalTimelineQualitySchema,
} from "./personal-timeline.schema";

export const PERSONAL_TIMELINE_LIMIT = 30;

const TimelineRowSchema = z
  .object({
    id: z.string().uuid(),
    event_type: z.string().min(1).max(80),
    occurred_at: z.string().datetime({ offset: true }),
    created_at: z.string().datetime({ offset: true }),
    timezone: z.string().max(80).nullable(),
    provenance: z.string().min(1).max(80),
    quality: z.string().min(1).max(80),
    source_system: z.string().min(1).max(80),
    source_table: z.string().min(1).max(80).nullable(),
    source_reference: z.string().min(1).max(200).nullable(),
    schema_version: z.string().min(1).max(40),
    summary: z.unknown().optional(),
  })
  .strict();

const EnduranceAdaptationSummarySchema = z
  .object({
    decisionOn: z.string().date().optional(),
    action: z.enum(["hold", "reduce", "recover"]),
    volumeModifier: z.number().positive().max(1),
    reason: z.enum([
      "insufficient_evidence",
      "on_track",
      "repeated_low_response",
      "low_readiness_and_missed_work",
      "repeated_over_target_work",
    ]),
  })
  .passthrough();

const EnduranceAdaptationObservedSummarySchema = z
  .object({
    association: z.enum([
      "improved_signals",
      "mixed_signals",
      "worse_signals",
      "insufficient_signal",
    ]),
    causalClaim: z.literal(false),
    facts: z.array(z.string().min(1).max(160)).max(8),
  })
  .passthrough();

export type PersonalTimelineDetails =
  | {
      kind: "endurance_adaptation";
      decisionOn: string | null;
      action: "hold" | "reduce" | "recover";
      volumeModifier: number;
      reason:
        | "insufficient_evidence"
        | "on_track"
        | "repeated_low_response"
        | "low_readiness_and_missed_work"
        | "repeated_over_target_work";
    }
  | {
      kind: "endurance_adaptation_observed";
      association:
        | "improved_signals"
        | "mixed_signals"
        | "worse_signals"
        | "insufficient_signal";
      causalClaim: false;
      facts: string[];
    }
  | null;

export type PersonalTimelineEntry = {
  id: string;
  eventType: z.infer<typeof PersonalTimelineEventTypeSchema> | null;
  occurredAt: string;
  recordedAt: string;
  timeZone: string | null;
  provenance: z.infer<typeof PersonalTimelineProvenanceSchema> | null;
  quality: z.infer<typeof PersonalTimelineQualitySchema> | null;
  sourceSystem: string;
  sourceTable: string | null;
  sourceReference: string | null;
  schemaVersion: string;
  details: PersonalTimelineDetails;
};

export type PersonalTimelinePage = {
  events: PersonalTimelineEntry[];
  omittedCount: number;
  hasMore: boolean;
  limit: number;
};

function detailsFor(
  eventType: z.infer<typeof PersonalTimelineEventTypeSchema> | null,
  summary: unknown,
): PersonalTimelineDetails {
  if (eventType === "endurance_adaptation") {
    const parsed = EnduranceAdaptationSummarySchema.safeParse(summary);
    if (!parsed.success) return null;
    return {
      kind: "endurance_adaptation",
      decisionOn: parsed.data.decisionOn ?? null,
      action: parsed.data.action,
      volumeModifier: parsed.data.volumeModifier,
      reason: parsed.data.reason,
    };
  }

  if (eventType === "endurance_adaptation_observed") {
    const parsed = EnduranceAdaptationObservedSummarySchema.safeParse(summary);
    if (!parsed.success) return null;
    return {
      kind: "endurance_adaptation_observed",
      association: parsed.data.association,
      causalClaim: false,
      facts: parsed.data.facts,
    };
  }

  return null;
}

/**
 * A bounded read model, not a historical DigitalAthleteState reconstruction.
 * Raw timeline summaries never cross the browser boundary: only explicitly
 * validated details for supported event types are projected.
 */
export function buildPersonalTimelinePage(value: unknown): PersonalTimelinePage {
  const rows = z
    .array(z.unknown())
    .max(PERSONAL_TIMELINE_LIMIT + 1)
    .parse(value);
  let omittedCount = 0;
  const events: PersonalTimelineEntry[] = [];

  for (const value of rows.slice(0, PERSONAL_TIMELINE_LIMIT)) {
    const result = TimelineRowSchema.safeParse(value);
    if (!result.success) {
      omittedCount += 1;
      continue;
    }
    const row = result.data;
    const eventType = PersonalTimelineEventTypeSchema.safeParse(row.event_type);
    const provenance = PersonalTimelineProvenanceSchema.safeParse(row.provenance);
    const quality = PersonalTimelineQualitySchema.safeParse(row.quality);
    const timeZone = IanaTimeZoneSchema.safeParse(row.timezone);
    const parsedEventType = eventType.success ? eventType.data : null;

    events.push({
      id: row.id,
      eventType: parsedEventType,
      occurredAt: row.occurred_at,
      recordedAt: row.created_at,
      timeZone: timeZone.success ? timeZone.data : null,
      provenance: provenance.success ? provenance.data : null,
      quality: quality.success ? quality.data : null,
      sourceSystem: row.source_system,
      sourceTable: row.source_table,
      sourceReference: row.source_reference,
      schemaVersion: row.schema_version,
      details: detailsFor(parsedEventType, row.summary),
    });
  }

  events.sort((left, right) => {
    const byTime = Date.parse(right.occurredAt) - Date.parse(left.occurredAt);
    if (byTime !== 0) return byTime;
    return left.id === right.id ? 0 : left.id < right.id ? 1 : -1;
  });

  return {
    events,
    omittedCount,
    hasMore: rows.length > PERSONAL_TIMELINE_LIMIT,
    limit: PERSONAL_TIMELINE_LIMIT,
  };
}
