import { z } from "zod";
import { DataProvenanceSchema } from "./data-provenance.schema";

const TimestampSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => Number.isFinite(Date.parse(value)), "Expected a valid timestamp.");

export const TimelineQualitySchema = z.enum(["unknown", "low", "moderate", "high"]);

export const PersonalTimelineEventSchema = z
  .object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    eventType: z
      .string()
      .trim()
      .regex(/^[a-z][a-z0-9_]{2,79}$/),
    occurredAt: TimestampSchema,
    timezone: z.string().trim().min(1).max(80).nullable(),
    provenance: DataProvenanceSchema,
    quality: TimelineQualitySchema,
    sourceSystem: z.string().trim().min(1).max(80),
    sourceTable: z.string().trim().min(1).max(120).nullable(),
    sourceReference: z.string().trim().min(1).max(240).nullable(),
    schemaVersion: z
      .string()
      .trim()
      .regex(/^[1-9][0-9]*[.][0-9]+$/),
    summary: z.record(z.string(), z.unknown()),
    createdAt: TimestampSchema,
  })
  .strict();

export type PersonalTimelineEvent = z.infer<typeof PersonalTimelineEventSchema>;

const PersonalTimelineEventRowSchema = z
  .object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    event_type: z.string(),
    occurred_at: TimestampSchema,
    timezone: z.string().nullable(),
    provenance: z.string(),
    quality: z.string(),
    source_system: z.string(),
    source_table: z.string().nullable(),
    source_reference: z.string().nullable(),
    schema_version: z.string(),
    summary: z.unknown(),
    created_at: TimestampSchema,
  })
  .strict();

/** Validates the database -> domain boundary without turning source facts into derived facts. */
export function parsePersonalTimelineEvent(value: unknown): PersonalTimelineEvent {
  const row = PersonalTimelineEventRowSchema.parse(value);
  return PersonalTimelineEventSchema.parse({
    id: row.id,
    userId: row.user_id,
    eventType: row.event_type,
    occurredAt: row.occurred_at,
    timezone: row.timezone,
    provenance: row.provenance,
    quality: row.quality,
    sourceSystem: row.source_system,
    sourceTable: row.source_table,
    sourceReference: row.source_reference,
    schemaVersion: row.schema_version,
    summary: row.summary,
    createdAt: row.created_at,
  });
}
