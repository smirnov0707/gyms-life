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


/** Secondary audit write: never make a completed training action look failed. */
export async function tryPersistCurrentEnduranceAdaptation(
  supabase: SupabaseClient<Database>,
  userId: string,
  today: string,
  timeZone: string,
): Promise<void> {
  try {
    await persistCurrentEnduranceAdaptation(supabase, userId, today, timeZone);
    const { recordDueAdaptationOutcomes } = await import(
      "./endurance-adaptation-outcome.service"
    );
    await recordDueAdaptationOutcomes(supabase, userId);
  } catch {
    // The canonical workout/session match remains the source fact. The ledger
    // can be reconciled later; surfacing a false primary-action failure is worse.
  }
}
