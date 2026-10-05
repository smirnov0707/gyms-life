import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { RaceGoalSchema } from "./endurance-race-goal.schema";
import { buildRacePlan } from "./endurance-race-plan.engine";
import { loadRacePlanBaseline } from "./endurance-race-baseline.service";
import { summarizeRaceWeek } from "./endurance-race-progress.engine";

const DAY_MS = 86_400_000;
const dayDiff = (a: string, b: string) => Math.floor((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / DAY_MS);

export async function loadActiveRacePrep(
  supabase: SupabaseClient<Database>,
  userId: string,
  today: string,
) {
  const { data: row, error } = await supabase
    .from("endurance_race_goals")
    .select("id,distance,race_date,target_time_seconds,sessions_per_week")
    .eq("user_id", userId).eq("status", "active").maybeSingle();
  if (error) throw error;
  if (!row) return { status: "none" as const };

  const goal = RaceGoalSchema.parse({
    distance: row.distance, raceDate: row.race_date, targetTimeSeconds: row.target_time_seconds,
    sessionsPerWeek: row.sessions_per_week, longestRecentRunMeters: null,
  });
  const baseline = await loadRacePlanBaseline(supabase, userId);
  const plan = buildRacePlan({ today, goal, baseline });
  const elapsedWeeks = Math.max(0, Math.floor(dayDiff(today, goal.raceDate) < 0 ? plan.weeks : 0));
  const daysToRace = Math.max(0, dayDiff(today, goal.raceDate));
  const weeksRemaining = Math.max(1, Math.ceil(daysToRace / 7));
  const weekIndex = Math.min(plan.weeks - 1, Math.max(0, plan.weeks - weeksRemaining));
  const currentWeek = plan.weeksPlan[weekIndex]!;

  const weekStart = new Date(Date.parse(today + "T00:00:00Z") - 6 * DAY_MS).toISOString();
  const { data: runs, error: runsError } = await supabase
    .from("workout_sessions").select("distance_meters,duration_seconds,perceived_effort")
    .eq("user_id", userId).eq("activity_kind", "run").not("finished_at", "is", null)
    .gte("started_at", weekStart).order("started_at", { ascending: true });
  if (runsError) throw runsError;

  const completed = (runs ?? []).map((run) => ({
    distanceMeters: run.distance_meters === null ? null : Number(run.distance_meters),
    durationMinutes: Number(run.duration_seconds ?? 0) / 60,
    perceivedEffort: run.perceived_effort,
  }));
  const progress = summarizeRaceWeek({ planned: currentWeek.sessions, completed });
  const nextSession = currentWeek.sessions[Math.min(completed.length, currentWeek.sessions.length - 1)] ?? null;

  return { status: "active" as const, goalId: row.id, daysToRace, currentWeek, progress, nextSession, baseline: plan.baseline, elapsedWeeks };
}
