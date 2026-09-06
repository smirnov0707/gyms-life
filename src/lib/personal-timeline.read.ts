import { z } from "zod";
import { IanaTimeZoneSchema } from "./local-day";
import {
  PersonalTimelineEventTypeSchema,
  PersonalTimelineProvenanceSchema,
  PersonalTimelineQualitySchema,
} from "./personal-timeline.schema";

export const PERSONAL_TIMELINE_LIMIT = 30;

/** Deliberately excludes summary and user_id from the browser projection. */
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
  })
  .strict();

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
};

export type PersonalTimelinePage = {
  events: PersonalTimelineEntry[];
  omittedCount: number;
  hasMore: boolean;
  limit: number;
};

/**
 * A bounded read model, not a historical DigitalAthleteState reconstruction.
 * Unknown vocabulary remains unknown. Malformed rows are explicitly counted;
 * a malformed response is a failure, never an apparently empty history.
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
    events.push({
      id: row.id,
      eventType: eventType.success ? eventType.data : null,
      occurredAt: row.occurred_at,
      // created_at is the index write time, not the original source write time.
      recordedAt: row.created_at,
      timeZone: timeZone.success ? timeZone.data : null,
      provenance: provenance.success ? provenance.data : null,
      quality: quality.success ? quality.data : null,
      sourceSystem: row.source_system,
      sourceTable: row.source_table,
      sourceReference: row.source_reference,
      schemaVersion: row.schema_version,
    });
  }

  // Compare instants, not ISO strings: offsets can reverse lexical ordering.
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
