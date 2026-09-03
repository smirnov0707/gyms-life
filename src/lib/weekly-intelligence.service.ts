import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { refreshAthleteStateSnapshot } from "./athlete-state-snapshot.server";
import type { UserMemoryTransparencyItem } from "./user-memory.schema";
import { loadUserMemoryTransparency } from "./user-memory.service";
import { buildWeeklyIntelligenceReview } from "./weekly-intelligence.engine";
import type { WeeklyIntelligenceReview } from "./weekly-intelligence.schema";

/**
 * Refreshes the signed-in athlete's canonical state before loading active
 * memory, so a deterministic discovery created from this exact state can be
 * visible in the same weekly review. If any source was unavailable, old
 * discoveries are held back rather than presented as current. A memory-query
 * failure never hides the user's verified weekly metrics.
 */
export async function loadWeeklyIntelligenceReview(
  supabase: SupabaseClient<Database>,
  userId: string,
  timeZone = "UTC",
  now = new Date(),
): Promise<WeeklyIntelligenceReview> {
  const athlete = await refreshAthleteStateSnapshot(supabase, userId, timeZone, now);
  const memories =
    athlete.snapshot === null
      ? []
      : await loadUserMemoryTransparency(supabase, userId).catch(
          (): UserMemoryTransparencyItem[] => [],
        );

  return buildWeeklyIntelligenceReview({
    state: athlete.state,
    memories,
  });
}
