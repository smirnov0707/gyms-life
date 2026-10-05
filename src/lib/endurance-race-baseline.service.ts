import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { RacePlanBaseline } from "./endurance-race-plan.engine";

const DAY_MS = 86_400_000;

export async function loadRacePlanBaseline(
  supabase: SupabaseClient<Database>,
  userId: string,
  now = new Date(),
): Promise<RacePlanBaseline> {
  const since = new Date(now.getTime() - 28 * DAY_MS).toISOString();
  const { data, error } = await supabase
    .from("workout_sessions")
    .select("started_at, distance_meters")
    .eq("user_id", userId)
    .eq("activity_kind", "run")
    .not("finished_at", "is", null)
    .gte("started_at", since)
    .order("started_at", { ascending: false })
    .limit(100);
  if (error) throw error;

  const runs = (data ?? []).filter((row) => row.distance_meters !== null && Number(row.distance_meters) > 0);
  if (runs.length === 0) return { recentWeeklyDistanceMeters: null, recentLongestRunMeters: null };
  const total = runs.reduce((sum, row) => sum + Number(row.distance_meters), 0);
  return {
    recentWeeklyDistanceMeters: Math.round(total / 4),
    recentLongestRunMeters: Math.round(Math.max(...runs.map((row) => Number(row.distance_meters)))),
  };
}
