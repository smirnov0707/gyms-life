import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { RaceGoalSchema } from "./endurance-race-goal.schema";
import { buildRacePlan } from "./endurance-race-plan.engine";
import { loadRacePlanBaseline } from "./endurance-race-baseline.service";
import { summarizeRaceWeek } from "./endurance-race-progress.engine";
import { assessRaceReadiness } from "./endurance-race-readiness.engine";
import { loadDigitalAthleteState } from "./digital-athlete.service";
import { assessLongRunProgress, raceSpecificLongRunCoverage } from "./endurance-long-run.engine";
import { RACE_DISTANCE_METERS } from "./endurance-activity.schema";

const DAY_MS = 86_400_000;
const dayDiff = (a: string, b: string) => Math.floor((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / DAY_MS);

export async function loadActiveRacePrep(
  supabase: SupabaseClient<Database>,
  userId: string,
  today: string,
) {
  const { data: row, error } = await supabase
    .from("endurance_race_goals")
    .select("id,distance,race_date,target_time_seconds,sessions_per_week,created_at")
    .eq("user_id", userId).eq("status", "active").maybeSingle();
  if (error) throw error;
  if (!row) return { status: "none" as const };

  const goal = RaceGoalSchema.parse({
    distance: row.distance, raceDate: row.race_date, targetTimeSeconds: row.target_time_seconds,
    sessionsPerWeek: row.sessions_per_week, longestRecentRunMeters: null,
  });
  const baseline = await loadRacePlanBaseline(supabase, userId);
  const startDay = row.created_at.slice(0, 10);
  const plan = buildRacePlan({ today: startDay, goal, baseline });
  const elapsedDays = Math.max(0, dayDiff(startDay, today));
  const elapsedWeeks = Math.floor(elapsedDays / 7);
  const daysToRace = Math.max(0, dayDiff(today, goal.raceDate));
  const weekIndex = Math.min(plan.weeks - 1, elapsedWeeks);
  const currentWeek = plan.weeksPlan[weekIndex]!;

  const weekStart = new Date(Date.parse(today + "T00:00:00Z") - 6 * DAY_MS).toISOString();
  const { data: runs, error: runsError } = await supabase
    .from("workout_sessions").select("distance_meters,duration_seconds,perceived_effort,endurance_session_intent")
    .eq("user_id", userId).eq("activity_kind", "run").not("finished_at", "is", null)
    .gte("started_at", weekStart).order("started_at", { ascending: true });
  if (runsError) throw runsError;

  const completed = (runs ?? []).map((run) => ({
    distanceMeters: run.distance_meters === null ? null : Number(run.distance_meters),
    durationMinutes: Number(run.duration_seconds ?? 0) / 60,
    perceivedEffort: run.perceived_effort,
  }));
  const progress = summarizeRaceWeek({ planned: currentWeek.sessions, completed });
  const matchedIntents = new Set((runs ?? []).flatMap((run) => run.endurance_session_intent ? [run.endurance_session_intent] : []));
  const nextSession = currentWeek.sessions.find((session) => !matchedIntents.has(session.intent))
    ?? currentWeek.sessions[Math.min(completed.length, currentWeek.sessions.length - 1)]
    ?? null;
  const historySince = new Date(Date.now() - 84 * DAY_MS).toISOString();
  const { data: longHistory, error: longHistoryError } = await supabase
    .from("workout_sessions")
    .select("started_at,distance_meters,endurance_session_intent")
    .eq("user_id", userId).eq("activity_kind", "run").not("finished_at", "is", null)
    .gte("started_at", historySince).order("started_at", { ascending: true });
  if (longHistoryError) throw longHistoryError;
  const longCandidates = (longHistory ?? []).filter((run) => run.distance_meters !== null && (run.endurance_session_intent === "long" || Number(run.distance_meters) >= 8000)).map((run) => ({ day: run.started_at.slice(0,10), distanceMeters: Number(run.distance_meters) }));
  const longRunProgress = assessLongRunProgress(longCandidates);
  const longRunCoverage = raceSpecificLongRunCoverage(longRunProgress.recentLongestMeters, RACE_DISTANCE_METERS[goal.distance]);

    const sessionRate = progress.plannedSessions > 0 ? progress.completedSessions / progress.plannedSessions : null;
  const athlete = await loadDigitalAthleteState(supabase, userId, new Date(), "UTC");
  const latestScore = athlete.recovery.latestReadinessScore;
  const readinessBand = latestScore === null ? "unknown" : latestScore < 55 ? "low" : latestScore < 80 ? "moderate" : "high";
  const readiness = assessRaceReadiness({
    weeksObserved: elapsedWeeks,
    sessionCompletionRate: sessionRate,
    distanceCompletionRate: progress.distanceCompletionRatio,
    longestRunProgressRate: longRunCoverage,
    recentLowResponseStreak: athlete.training.selfReportedResponse.recentLowFeelingStreak,
    latestReadinessBand: readinessBand,
    repeatedOverTargetRuns: 0,
  });

  return { status: "active" as const, goalId: row.id, daysToRace, currentWeek, progress, nextSession, baseline: plan.baseline, elapsedWeeks, readiness, longRunProgress, longRunCoverage };
}
