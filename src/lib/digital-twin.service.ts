import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { refreshAthleteStateSnapshot } from "./athlete-state-snapshot.server";
import { mapDigitalAthleteStateToTwinSnapshot } from "./digital-twin.mapper";
import type { TwinSnapshot } from "./digital-twin.schema";

/**
 * Refreshes the canonical athlete state (same as Today/Lab) and maps it to
 * the Twin-renderer contract. No separate computation path: the Twin can
 * never show a different muscle-load number than the rest of the app.
 */
export async function loadTwinSnapshot(
  supabase: SupabaseClient<Database>,
  userId: string,
  timeZone = "UTC",
  now = new Date(),
): Promise<TwinSnapshot> {
  const athlete = await refreshAthleteStateSnapshot(supabase, userId, timeZone, now);
  return mapDigitalAthleteStateToTwinSnapshot(athlete.state, now);
}
