import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import {
  TwinMemoryProactiveLifecycleEventSchema,
  TwinMemoryProactiveRecordSchema,
  TwinMemoryProactiveSignalSchema,
  nextTwinMemoryProactiveStatus,
  type TwinMemoryProactiveLifecycleAction,
  type TwinMemoryProactiveRecord,
  type TwinMemoryProactiveStatus,
} from "./twin-memory-proactive";

const ProactiveTimelineRowSchema = z
  .object({
    event_type: z.enum(["twin_memory_change", "twin_memory_seen", "twin_memory_dismissed"]),
    occurred_at: z.string().datetime({ offset: true }),
    source_reference: z.string().min(1).max(300),
    summary: z.unknown(),
  })
  .strict();

type ProactiveTimelineRow = z.infer<typeof ProactiveTimelineRowSchema>;

export function composeTwinMemoryProactiveRecords(
  input: unknown,
  limit = 6,
): TwinMemoryProactiveRecord[] {
  const parsed = z.array(ProactiveTimelineRowSchema).safeParse(input);
  if (!parsed.success) return [];
  const rows = parsed.data;
  const lifecycle = new Map<string, { action: TwinMemoryProactiveLifecycleAction; at: string }>();

  for (const row of rows) {
    if (row.event_type === "twin_memory_change" || lifecycle.has(row.source_reference)) continue;
    const event = TwinMemoryProactiveLifecycleEventSchema.safeParse(row.summary);
    if (!event.success || event.data.fingerprint !== row.source_reference) continue;
    const expected = row.event_type === "twin_memory_seen" ? "seen" : "dismissed";
    if (event.data.action !== expected) continue;
    lifecycle.set(row.source_reference, { action: event.data.action, at: row.occurred_at });
  }

  const records: TwinMemoryProactiveRecord[] = [];
  for (const row of rows) {
    if (row.event_type !== "twin_memory_change") continue;
    const signal = TwinMemoryProactiveSignalSchema.safeParse(row.summary);
    if (!signal.success || signal.data.fingerprint !== row.source_reference) continue;
    const lifecycleEvent = lifecycle.get(signal.data.fingerprint);
    const lifecycleIsAfterChange =
      lifecycleEvent && Date.parse(lifecycleEvent.at) >= Date.parse(row.occurred_at);
    const status: TwinMemoryProactiveStatus = lifecycleIsAfterChange
      ? lifecycleEvent.action
      : "new";
    const record = TwinMemoryProactiveRecordSchema.safeParse({
      ...signal.data,
      occurredAt: row.occurred_at,
      status,
      statusChangedAt: lifecycleIsAfterChange ? lifecycleEvent.at : null,
    });
    if (record.success) records.push(record.data);
    if (records.length >= limit) break;
  }
  return records;
}

export async function loadTwinMemoryProactiveRecords(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit = 6,
): Promise<TwinMemoryProactiveRecord[]> {
  const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 20);
  const { data, error } = await supabase
    .from("personal_timeline_events")
    .select("event_type,occurred_at,source_reference,summary")
    .eq("user_id", userId)
    .in("event_type", ["twin_memory_change", "twin_memory_seen", "twin_memory_dismissed"])
    .eq("source_system", "gymslife")
    .eq("source_table", "twin_memory")
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(boundedLimit * 3);
  if (error || data === null) return [];
  return composeTwinMemoryProactiveRecords(data, boundedLimit);
}

export async function transitionTwinMemoryProactiveRecord(
  userId: string,
  fingerprint: string,
  action: TwinMemoryProactiveLifecycleAction,
): Promise<{ status: TwinMemoryProactiveStatus }> {
  const safeFingerprint = z.string().min(1).max(300).parse(fingerprint);
  const safeAction = z.enum(["seen", "dismissed"]).parse(action);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: source, error: sourceError } = await supabaseAdmin
    .from("personal_timeline_events")
    .select("id")
    .eq("user_id", userId)
    .eq("event_type", "twin_memory_change")
    .eq("source_system", "gymslife")
    .eq("source_table", "twin_memory")
    .eq("source_reference", safeFingerprint)
    .maybeSingle();
  if (sourceError || !source) throw new Error("Twin Memory change is unavailable.");

  const { data: lifecycleRows, error: lifecycleError } = await supabaseAdmin
    .from("personal_timeline_events")
    .select("event_type")
    .eq("user_id", userId)
    .eq("source_system", "gymslife")
    .eq("source_table", "twin_memory")
    .eq("source_reference", safeFingerprint)
    .in("event_type", ["twin_memory_seen", "twin_memory_dismissed"]);
  if (lifecycleError || lifecycleRows === null)
    throw new Error("Twin Memory state is unavailable.");

  const current: TwinMemoryProactiveStatus = lifecycleRows.some(
    (row) => row.event_type === "twin_memory_dismissed",
  )
    ? "dismissed"
    : lifecycleRows.some((row) => row.event_type === "twin_memory_seen")
      ? "seen"
      : "new";
  const next = nextTwinMemoryProactiveStatus(current, safeAction);
  if (next === current) return { status: current };

  const eventType = next === "dismissed" ? "twin_memory_dismissed" : "twin_memory_seen";
  const summary = TwinMemoryProactiveLifecycleEventSchema.parse({
    fingerprint: safeFingerprint,
    action: next,
    source: "deterministic",
    decisionAuthority: false,
  });
  const { error: writeError } = await supabaseAdmin.from("personal_timeline_events").upsert(
    {
      user_id: userId,
      event_type: eventType,
      occurred_at: new Date().toISOString(),
      timezone: null,
      provenance: "calculated",
      source_system: "gymslife",
      source_table: "twin_memory",
      source_reference: safeFingerprint,
      summary,
    },
    { onConflict: "user_id,source_system,source_reference,event_type", ignoreDuplicates: true },
  );
  if (writeError) throw new Error("Could not update Twin Memory change state.");
  return { status: next };
}
