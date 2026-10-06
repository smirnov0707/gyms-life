import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { loadActiveRacePrep } from "./endurance-race-prep.service";
import { persistEnduranceAdaptation } from "./endurance-adaptation-ledger.service";

export async function persistCurrentEnduranceAdaptation(
  supabase: SupabaseClient<Database>,
  userId: string,
  today: string,
  timeZone: string,
) {
  const prep = await loadActiveRacePrep(supabase, userId, today, timeZone);
  if (prep.status !== "active") return null;
  return persistEnduranceAdaptation(supabase, {
    userId,
    raceGoalId: prep.goalId,
    decisionOn: today,
    signal: prep.adaptationSignal,
    decision: prep.adaptation,
  });
}
