import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildTwinTrendHistory, TWIN_TREND_LIMIT, type TwinTrendHistory } from "./twin-trend";

/** Uses the authenticated request client; RLS remains authoritative. */
export async function loadTwinTrendHistory(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<TwinTrendHistory> {
  if (!userId) throw new Error("Authentication is required.");

  const { data, error } = await supabase
    .from("athlete_state_snapshots")
    .select("id,schema_version,calculation_version,computed_at,state")
    .eq("user_id", userId)
    .order("computed_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(TWIN_TREND_LIMIT + 1);

  if (error || data === null) throw new Error("Twin trend history is temporarily unavailable.");
  return buildTwinTrendHistory(data);
}
