import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { PERSONAL_TIMELINE_LIMIT } from "./personal-timeline.read";
import {
  buildTwinEvidenceWindow,
  normalizeTwinEvidenceWindowInput,
  type TwinEvidenceWindow,
  type TwinEvidenceWindowInput,
} from "./twin-evidence-window";

/**
 * Reads only the authenticated user's compact Timeline index. The browser can
 * choose an interval but never an identity; RLS remains authoritative.
 * Server-owned hypothesis transitions are deliberately excluded: they are
 * derived audit state and must never be presented as evidence for Twin change.
 */
export async function loadTwinEvidenceWindow(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: TwinEvidenceWindowInput,
): Promise<TwinEvidenceWindow> {
  if (!userId) throw new Error("Authentication is required.");
  const interval = normalizeTwinEvidenceWindowInput(input);

  const { data, error } = await supabase
    .from("personal_timeline_events")
    .select(
      "id,event_type,occurred_at,created_at,timezone,provenance,quality,source_system,source_table,source_reference,schema_version",
    )
    .eq("user_id", userId)
    .neq("event_type", "hypothesis_transition")
    .gt("occurred_at", interval.olderAt)
    .lte("occurred_at", interval.newerAt)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PERSONAL_TIMELINE_LIMIT + 1);

  if (error || data === null) throw new Error("Twin evidence is temporarily unavailable.");
  return buildTwinEvidenceWindow(interval, data);
}
