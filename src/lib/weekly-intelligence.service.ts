import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { DigitalAthleteState } from "./digital-athlete.schema";
import { loadDigitalAthleteState } from "./digital-athlete.service";
import type { UserMemoryTransparencyItem } from "./user-memory.schema";
import { loadUserMemoryTransparency } from "./user-memory.service";
import { buildWeeklyIntelligenceReview } from "./weekly-intelligence.engine";
import type { WeeklyIntelligenceReview } from "./weekly-intelligence.schema";

/**
 * Reads only the signed-in athlete's canonical state and active memory.
 * A temporary memory-query failure becomes an empty discovery list rather
 * than hiding the user's verified weekly metrics.
 */
export async function loadWeeklyIntelligenceReview(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<WeeklyIntelligenceReview> {
  const requests = [
    loadDigitalAthleteState(supabase, userId),
    loadUserMemoryTransparency(supabase, userId),
  ] satisfies readonly [Promise<DigitalAthleteState>, Promise<UserMemoryTransparencyItem[]>];
  const [stateResult, memoryResult] = await Promise.allSettled(requests);

  if (stateResult.status !== "fulfilled") {
    throw new Error("Could not load weekly athlete state.");
  }

  return buildWeeklyIntelligenceReview({
    state: stateResult.value,
    memories: memoryResult.status === "fulfilled" ? memoryResult.value : [],
  });
}
