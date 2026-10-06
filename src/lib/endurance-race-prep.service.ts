import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { RaceGoalSchema } from "./endurance-race-goal.schema";
import { buildRacePlan } from "./endurance-race-plan.engine";
import { evaluatePlannedRun, summarizeRaceWeek } from "./endurance-race-progress.engine";
import { assessRaceReadiness } from "./endurance-race-readiness.engine";
import { loadDigitalAthleteState } from "./digital-athlete.service";
import { assessLongRunProgress, raceSpecificLongRunCoverage } from "./endurance-long-run.engine";
import { RACE_DISTANCE_METERS } from "./endurance-activity.schema";
import { buildPaceProfile } from "./endurance-pace.engine";
import { assessTerrainResponse, classifyTerrain } from "./endurance-terrain.engine";
import { assessComparableEfficiencyTrend } from "./endurance-running-efficiency.engine";
import { decideEnduranceAdaptation } from "./endurance-adaptation.engine";
import { decideRaceIntelligence } from "./endurance-race-intelligence.engine";
import {
  loadEnduranceAdaptationLesson,
  loadLatestEnduranceAdaptation,
} from "./endurance-adaptation-ledger.service";
import {
  applyAdaptationToRemainingSessions,
  selectNextExecutableSession,
} from "./endurance-effective-plan.engine";
import {
  calendarDayDifference,
  dayBoundsInTimeZone,
  dayInTimeZone,
  dayOffset,
  IanaTimeZoneSchema,
} from "./local-day";

export async function loadActiveRacePrep(
  supabase: SupabaseClient<Database>,
  userId: string,
  today: string,
  timeZone = "UTC",
) {
  const zone = IanaTimeZoneSchema.parse(timeZone);
  const { data: row, error } = await supabase
    .from("endurance_race_goals")
    .select(
      "id,distance,race_date,started_on,target_time_seconds,sessions_per_week,baseline_weekly_distance_meters,baseline_longest_run_meters",
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .gte("race_date", today)
    .maybeSingle();
  if (error) throw error;
  if (!row) return { status: "none" as const };

  const goal = RaceGoalSchema.parse({
    distance: row.distance,
    raceDate: row.race_date,
    targetTimeSeconds: row.target_time_seconds,
    sessionsPerWeek: row.sessions_per_week,
    longestRecentRunMeters: null,
  });
  const baseline = {
    recentWeeklyDistanceMeters:
      row.baseline_weekly_distance_meters === null
        ? null
        : Number(row.baseline_weekly_distance_meters),
    recentLongestRunMeters:
      row.baseline_longest_run_meters === null ? null : Number(row.baseline_longest_run_meters),
  };
  const startDay = row.started_on;
  const plan = buildRacePlan({ today: startDay, goal, baseline });
  const elapsedDays = Math.max(0, calendarDayDifference(startDay, today));
  const elapsedWeeks = Math.floor(elapsedDays / 7);
  const daysToRace = Math.max(0, calendarDayDifference(today, goal.raceDate));
  const weekIndex = Math.min(plan.weeks - 1, elapsedWeeks);
  const currentWeek = plan.weeksPlan[weekIndex]!;

  const weekStartDay = dayOffset(startDay, weekIndex * 7);
  const weekEndDay = dayOffset(weekStartDay, 7);
  const weekStart = dayBoundsInTimeZone(weekStartDay, zone).start;
  const weekEnd = dayBoundsInTimeZone(weekEndDay, zone).start;
  const { data: runs, error: runsError } = await supabase
    .from("workout_sessions")
    .select(
      "distance_meters,duration_seconds,perceived_effort,endurance_session_intent,endurance_plan_session_key,endurance_race_goal_id",
    )
    .eq("user_id", userId)
    .eq("activity_kind", "run")
    .not("finished_at", "is", null)
    .gte("started_at", weekStart)
    .lt("started_at", weekEnd)
    .order("started_at", { ascending: true });
  if (runsError) throw runsError;

  const completed = (runs ?? []).map((run) => ({
    planSessionKey: run.endurance_race_goal_id === row.id ? run.endurance_plan_session_key : null,
    distanceMeters: run.distance_meters === null ? null : Number(run.distance_meters),
    durationMinutes: Number(run.duration_seconds ?? 0) / 60,
    perceivedEffort: run.perceived_effort,
  }));
  const baseProgress = summarizeRaceWeek({ planned: currentWeek.sessions, completed });
  const plannedByKey = new Map(
    currentWeek.sessions.map((session) => [session.sessionKey, session] as const),
  );
  const recentOverTargetRuns = completed.filter((run) => {
    if (!run.planSessionKey) return false;
    const plannedSession = plannedByKey.get(run.planSessionKey);
    return plannedSession
      ? evaluatePlannedRun(plannedSession, run).status === "over_target"
      : false;
  }).length;

  const completedSessionKeys = new Set(
    (runs ?? []).flatMap((run) =>
      run.endurance_race_goal_id === row.id && run.endurance_plan_session_key
        ? [run.endurance_plan_session_key]
        : [],
    ),
  );
  const historySince = dayBoundsInTimeZone(dayOffset(today, -84), zone).start;
  const historyUntil = dayBoundsInTimeZone(dayOffset(today, 1), zone).start;
  const { data: longHistory, error: longHistoryError } = await supabase
    .from("workout_sessions")
    .select(
      "started_at,distance_meters,duration_seconds,endurance_session_intent,perceived_effort,elevation_gain_meters,average_heart_rate_bpm",
    )
    .eq("user_id", userId)
    .eq("activity_kind", "run")
    .not("finished_at", "is", null)
    .gte("started_at", historySince)
    .lt("started_at", historyUntil)
    .order("started_at", { ascending: true });
  if (longHistoryError) throw longHistoryError;
  const longCandidates = (longHistory ?? [])
    .filter(
      (run) =>
        run.distance_meters !== null &&
        (run.endurance_session_intent === "long" || Number(run.distance_meters) >= 8000),
    )
    .map((run) => ({
      day: dayInTimeZone(new Date(run.started_at), zone),
      distanceMeters: Number(run.distance_meters),
    }));
  const paceProfile = buildPaceProfile(
    (longHistory ?? []).flatMap((run) =>
      run.distance_meters !== null && run.duration_seconds !== null
        ? [
            {
              day: dayInTimeZone(new Date(run.started_at), zone),
              distanceMeters: Number(run.distance_meters),
              durationSeconds: Number(run.duration_seconds),
              intent: run.endurance_session_intent as
                "easy" | "long" | "tempo" | "intervals" | "recovery" | "race" | null,
              perceivedEffort: run.perceived_effort,
            },
          ]
        : [],
    ),
  );
  const terrainResponse = assessTerrainResponse(
    (longHistory ?? []).flatMap((run) =>
      run.distance_meters !== null && run.duration_seconds !== null
        ? [
            {
              day: dayInTimeZone(new Date(run.started_at), zone),
              distanceMeters: Number(run.distance_meters),
              durationSeconds: Number(run.duration_seconds),
              elevationGainMeters:
                run.elevation_gain_meters === null ? null : Number(run.elevation_gain_meters),
              averageHeartRateBpm: run.average_heart_rate_bpm,
            },
          ]
        : [],
    ),
  );
  const efficiencyTrend = assessComparableEfficiencyTrend(
    (longHistory ?? []).flatMap((run) =>
      run.distance_meters !== null && run.duration_seconds !== null
        ? [
            {
              day: dayInTimeZone(new Date(run.started_at), zone),
              distanceMeters: Number(run.distance_meters),
              durationSeconds: Number(run.duration_seconds),
              averageHeartRateBpm: run.average_heart_rate_bpm,
              terrain: classifyTerrain({
                day: dayInTimeZone(new Date(run.started_at), zone),
                distanceMeters: Number(run.distance_meters),
                durationSeconds: Number(run.duration_seconds),
                averageHeartRateBpm: run.average_heart_rate_bpm,
                elevationGainMeters:
                  run.elevation_gain_meters === null ? null : Number(run.elevation_gain_meters),
              }).classification,
              cadenceSpm: null,
            },
          ]
        : [],
    ),
  );
  const longRunProgress = assessLongRunProgress(longCandidates);
  const longRunCoverage = raceSpecificLongRunCoverage(
    longRunProgress.recentLongestMeters,
    RACE_DISTANCE_METERS[goal.distance],
  );

  const sessionRate =
    baseProgress.plannedSessions > 0
      ? baseProgress.completedSessions / baseProgress.plannedSessions
      : null;
  const athlete = await loadDigitalAthleteState(supabase, userId, new Date(), zone);
  const latestScore = athlete.currentDay.hasCompletedReadiness
    ? athlete.recovery.latestReadinessScore
    : null;
  const readinessBand =
    latestScore === null
      ? "unknown"
      : latestScore < 55
        ? "low"
        : latestScore < 80
          ? "moderate"
          : "high";
  const readiness = assessRaceReadiness({
    weeksObserved: elapsedWeeks,
    sessionCompletionRate: sessionRate,
    distanceCompletionRate: baseProgress.distanceCompletionRatio,
    longRunTrend: longRunProgress.status,
    recentLowResponseStreak: athlete.training.selfReportedResponse.recentLowFeelingStreak,
    latestReadinessBand: readinessBand,
    repeatedOverTargetRuns: recentOverTargetRuns,
  });

  const adaptationSignal = {
    completedPlannedSessions: baseProgress.completedSessions,
    plannedSessions: baseProgress.plannedSessions,
    lowResponseStreak: athlete.training.selfReportedResponse.recentLowFeelingStreak,
    readinessBand,
    distanceCompletionRatio: baseProgress.distanceCompletionRatio,
    recentOverTargetRuns,
  } as const;
  const candidateAdaptation = decideEnduranceAdaptation(adaptationSignal);
  const persistedAdaptation = await loadLatestEnduranceAdaptation(supabase, userId, row.id, today);
  const adaptation = persistedAdaptation ?? candidateAdaptation;
  const adaptationLesson = await loadEnduranceAdaptationLesson(supabase, userId, row.id);
  const executionAdaptation = persistedAdaptation ?? {
    action: "hold" as const,
    volumeModifier: 1 as const,
    reason: "insufficient_evidence" as const,
  };
  const effectiveSessions = applyAdaptationToRemainingSessions({
    sessions: currentWeek.sessions,
    completedSessionKeys,
    adaptation: executionAdaptation,
  });
  const progress = summarizeRaceWeek({ planned: effectiveSessions, completed });
  const nextSession = selectNextExecutableSession({
    sessions: effectiveSessions,
    completedSessionKeys,
    adaptation,
  });
  const intelligence = decideRaceIntelligence({
    readiness,
    adaptation,
    nextSessionIntent: nextSession?.intent ?? null,
    nextSessionDistanceMeters: nextSession?.plannedDistanceMeters ?? null,
    adaptationLesson,
  });
  return {
    status: "active" as const,
    goalId: row.id,
    raceDistance: goal.distance,
    daysToRace,
    currentWeek,
    effectiveSessions,
    baseProgress,
    progress,
    nextSession,
    intelligence,
    baseline: plan.baseline,
    elapsedWeeks,
    readiness,
    longRunProgress,
    longRunCoverage,
    paceProfile,
    terrainResponse,
    efficiencyTrend,
    adaptation,
    adaptationLesson,
    adaptationStatus: persistedAdaptation ? ("persisted" as const) : ("preview" as const),
    candidateAdaptation,
    adaptationSignal,
    completedSessionKeys: [...completedSessionKeys],
  };
}
