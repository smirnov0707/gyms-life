import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  buildPersonalTimelinePage,
  PERSONAL_TIMELINE_LIMIT,
  type PersonalTimelinePage,
} from "./personal-timeline.read";

/** Use the authenticated request client. Never substitute the admin client. */
export async function loadPersonalTimeline(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<PersonalTimelinePage> {
  if (!userId) throw new Error("Authentication is required.");

  const { data, error } = await supabase
    .from("personal_timeline_events")
    .select(
      "id,event_type,occurred_at,created_at,timezone,provenance,quality,source_system,source_table,source_reference,schema_version",
    )
    .eq("user_id", userId)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PERSONAL_TIMELINE_LIMIT + 1);

  // Do not turn a failed/null read into [], and do not expose database details.
  if (error || data === null) throw new Error("Personal timeline is temporarily unavailable.");
  return buildPersonalTimelinePage(data);
}
