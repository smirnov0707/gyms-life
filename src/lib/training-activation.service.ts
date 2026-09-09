import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { normalizeActivePlan } from "./active-plan.service";

/** Validate owned stored data before changing which programme controls a workout. */
export async function activateValidatedTrainingPlan(
  client: SupabaseClient<Database>,
  userId: string,
  planId: string,
): Promise<string> {
  const { data: row, error: readError } = await client
    .from("plans")
    .select("id,title,goal,weeks,days_per_week,created_at,data")
    .eq("id", planId)
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) throw new Error("Training programme could not be read.");
  if (!row) throw new Error("TRAINING_PLAN_NOT_FOUND");
  const plan = normalizeActivePlan(row);
  if ("status" in plan) throw new Error("TRAINING_PLAN_INVALID");
  const { data: open, error: openError } = await client
    .from("workout_sessions")
    .select("id")
    .eq("user_id", userId)
    .is("finished_at", null)
    .or(`plan_id.neq.${planId},plan_id.is.null`)
    .limit(1)
    .maybeSingle();
  if (openError) throw new Error("Could not verify unfinished workouts.");
  if (open) throw new Error("TRAINING_PLAN_OPEN_WORKOUT");
  const { data: activated, error } = await client.rpc("activate_training_plan", {
    p_plan_id: planId,
  });
  if (error || activated !== planId) throw new Error("Could not confirm programme activation.");
  return activated;
}
