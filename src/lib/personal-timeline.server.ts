import type { Json } from "@/integrations/supabase/types";
import {
  PersonalTimelineEventInputSchema,
  type PersonalTimelineEventInput,
} from "./personal-timeline.schema";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toJson(value: unknown): Json {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) return value.map(toJson);
  if (isRecord(value)) {
    const output: { [key: string]: Json | undefined } = {};
    for (const [key, nestedValue] of Object.entries(value)) output[key] = toJson(nestedValue);
    return output;
  }
  throw new Error("Personal timeline summary contains a non-JSON value.");
}

/**
 * Appends one canonical timeline event. Source facts remain in their
 * original domain table; this is a compact, auditable index only.
 *
 * Never throws: a timeline write is a secondary record of something that
 * already happened and persisted successfully elsewhere. Failing the
 * primary user action (finishing a workout, saving a check-in) over a
 * timeline-index write would be strictly worse than a missing index entry.
 */
export async function recordPersonalTimelineEvent(
  userId: string,
  input: PersonalTimelineEventInput,
): Promise<void> {
  try {
    const event = PersonalTimelineEventInputSchema.parse(input);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("personal_timeline_events").upsert(
      {
        user_id: userId,
        event_type: event.eventType,
        occurred_at: event.occurredAt,
        timezone: event.timeZone,
        provenance: event.provenance,
        source_system: event.sourceSystem,
        source_table: event.sourceTable,
        source_reference: event.sourceReference,
        summary: toJson(event.summary),
      },
      { onConflict: "user_id,source_system,source_reference,event_type", ignoreDuplicates: true },
    );
    if (error) throw new Error(error.message);
  } catch (cause) {
    const { recordObservabilityEvent } = await import("./observability.server");
    await recordObservabilityEvent({
      eventName: "personal_timeline.record",
      outcome: "failure",
      userId,
      errorCode: "PERSONAL_TIMELINE_WRITE_FAILED",
      metadata: { event_type: input.eventType },
    });
    void cause;
  }
}
