import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  buildTwinRewindHistory,
  TWIN_REWIND_LIMIT,
  type TwinRewindHistory,
} from "./twin-rewind";

/**
 * Reads immutable history through the authenticated request client so RLS is
 * still authoritative. The whole state is validated server-side but is never
 * returned as a browser payload.
 */
export async function loadTwinRewindHistory(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<TwinRewindHistory> {
  if (!userId) throw new Error("Authentication is required.");

  const { data, error } = await supabase
    .from("athlete_state_snapshots")
    .select(
      "id,schema_version,calculation_version,computed_at,source_window_start,source_window_end,state",
    )
    .eq("user_id", userId)
    .order("computed_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(TWIN_REWIND_LIMIT + 1);

  if (error || data === null) throw new Error("Twin history is temporarily unavailable.");
  return buildTwinRewindHistory(data);
}
