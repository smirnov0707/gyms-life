import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { RaceGoalSchema } from "./endurance-race-goal.schema";
import { buildRacePlan } from "./endurance-race-plan.engine";
import { loadRacePlanBaseline } from "./endurance-race-baseline.service";

export async function createRaceGoal(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: unknown,
  today: string,
) {
  const goal = RaceGoalSchema.parse(input);
  const baseline = await loadRacePlanBaseline(supabase, userId);
  const plan = buildRacePlan({ today, goal, baseline });

  const { data: existing, error: existingError } = await supabase
    .from("endurance_race_goals")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    const { error } = await supabase.from("endurance_race_goals").update({ status: "cancelled" }).eq("id", existing.id).eq("user_id", userId);
    if (error) throw error;
  }

  const { data, error } = await supabase.from("endurance_race_goals").insert({
    user_id: userId,
    distance: goal.distance,
    race_date: goal.raceDate,
    target_time_seconds: goal.targetTimeSeconds,
    sessions_per_week: goal.sessionsPerWeek,
  }).select("id").single();
  if (error) throw error;
  return { goalId: data.id, goal, baseline, plan };
}
