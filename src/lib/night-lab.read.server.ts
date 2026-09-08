import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { overnightWork, type OvernightRow, type OvernightWork } from "./night-lab.read";

/**
 * Reads the athlete's own `twin_recalculated` rows through the authenticated
 * request client, never the admin one: RLS stays the authority on identity.
 *
 * This is the one reader allowed to ask for an audit event type by name. The
 * generic timeline excludes all of them precisely so that a background job
 * never appears as something the athlete did; this screen is about the
 * background job, so it selects the type deliberately rather than filtering it
 * out. `personal-timeline.schema.ts` records why the two are different.
 *
 * A failed read becomes `unreadable`, never an empty answer. "No overnight run
 * has ever recalculated you" is a fact about the athlete, and telling it to
 * somebody whose Twin is maintained nightly, because a query failed, is the
 * defect this whole audit has been about.
 */

/** Enough rows to find the newest; the timeline is ordered, not trusted to be. */
const OVERNIGHT_ROW_LIMIT = 8;

export async function loadOvernightWork(
  supabase: SupabaseClient<Database>,
  userId: string,
  now: Date = new Date(),
): Promise<OvernightWork> {
  if (!userId) throw new Error("Authentication is required.");

  const { data, error } = await supabase
    .from("personal_timeline_events")
    .select("occurred_at, source_reference")
    .eq("user_id", userId)
    .eq("event_type", "twin_recalculated")
    .order("occurred_at", { ascending: false })
    .limit(OVERNIGHT_ROW_LIMIT);

  if (error || data === null) return overnightWork(null, now);

  const rows: OvernightRow[] = data.flatMap((row) =>
    row.source_reference === null
      ? []
      : [{ occurredAt: row.occurred_at, sourceReference: row.source_reference }],
  );
  return overnightWork(rows, now);
}
