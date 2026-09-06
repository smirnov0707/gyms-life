import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { refreshAthleteStateSnapshot } from "./athlete-state-snapshot.server";
import { mapDigitalAthleteStateToTwinSnapshot, twinBodyVariantFor } from "./digital-twin.mapper";
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
  const [athlete, profile] = await Promise.all([
    refreshAthleteStateSnapshot(supabase, userId, timeZone, now),
    // Which figure to draw, and nothing else. A failed or empty read is not a
    // reason to withhold the Twin — it falls back to the default body, which
    // the stage already labels as generic rather than as the athlete's own.
    supabase.from("profiles").select("gender").eq("id", userId).maybeSingle(),
  ]);
  return mapDigitalAthleteStateToTwinSnapshot(
    athlete.state,
    now,
    twinBodyVariantFor(profile.error ? null : profile.data?.gender),
  );
}
