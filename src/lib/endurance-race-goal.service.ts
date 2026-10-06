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

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: goalId, error } = await supabaseAdmin.rpc("replace_active_endurance_race_goal", {
    p_user_id: userId,
    p_distance: goal.distance,
    p_race_date: goal.raceDate,
    p_target_time_seconds: goal.targetTimeSeconds,
    p_sessions_per_week: goal.sessionsPerWeek,
    p_baseline_weekly_distance_meters: baseline.recentWeeklyDistanceMeters,
    p_baseline_longest_run_meters: baseline.recentLongestRunMeters,
  });
  if (error) throw error;
  return { goalId: goalId, goal, baseline, plan };
}
