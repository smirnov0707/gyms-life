import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { calculateAverage, calculateEstimated1RM, calculateVolume } from "./performance.engine";
import {
  parseCompletedWorkoutSessions,
  WORKOUT_SESSION_SELECT,
  type CompletedWorkoutSession,
} from "./workout-session.schema";
import {
  parseWorkoutSetLogs,
  WORKOUT_SET_LOG_SELECT,
  type WorkoutSetLog,
} from "./workout-set-log.schema";

export type PerformanceSetLog = WorkoutSetLog;
export type PerformanceSession = CompletedWorkoutSession;

export type PerformanceSnapshot = {
  date: string;
  weightKg: number | null;
  reps: number | null;
  rpe: number | null;
  estimated1RMKg: number | null;
};

export type ExercisePerformance = {
  exerciseSlug: string;
  exerciseName: string;
  sessions: number;
  totalSets: number;
  totalReps: number;
  totalVolume: number;
  bestWeightKg: number | null;
  bestReps: number | null;
  bestEstimated1RMKg: number | null;
  averageRpe: number | null;
  latest: PerformanceSnapshot | null;
};

export type PerformanceMetrics = {
  workouts: number;
  totalVolume: number;
  totalDurationSeconds: number;
  totalSets: number;
  totalReps: number;
  averageRpe: number | null;
};

export type PerformanceOverviewData = {
  sessions: PerformanceSession[];
  logs: PerformanceSetLog[];
  metrics: PerformanceMetrics;
  exercises: ExercisePerformance[];
};

type CompletedPerformance = Pick<PerformanceOverviewData, "sessions" | "logs">;

export async function loadCompletedPerformance(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<CompletedPerformance> {
  const { data: sessions, error: sessionError } = await supabase
    .from("workout_sessions")
    .select(WORKOUT_SESSION_SELECT)
    .eq("user_id", userId)
    .not("finished_at", "is", null)
    .order("finished_at", { ascending: true });

  if (sessionError) {
    throw new Error("Performance session lookup failed: " + sessionError.message);
  }

  const completedSessions = parseCompletedWorkoutSessions(sessions ?? []);
  if (!completedSessions.length) {
    return { sessions: [], logs: [] };
  }

  const ids = completedSessions.map((session) => session.id);
  const { data: logs, error: logError } = await supabase
    .from("set_logs")
    .select(WORKOUT_SET_LOG_SELECT)
    .eq("user_id", userId)
    .in("session_id", ids)
    .eq("done", true)
    .order("performed_at", { ascending: true });

  if (logError) {
    throw new Error("Performance set lookup failed: " + logError.message);
  }

  return { sessions: completedSessions, logs: parseWorkoutSetLogs(logs ?? []) };
}

export function aggregateExercisePerformance(
  logs: PerformanceSetLog[],
  slug: string,
): ExercisePerformance | null {
  const rows = logs.filter((log) => log.exerciseSlug === slug && log.done);
  if (!rows.length) {
    return null;
  }

  const weights = rows
    .map((row) => row.weightKg)
    .filter((value): value is number => value != null && value > 0);
  const reps = rows
    .map((row) => row.reps)
    .filter((value): value is number => value != null && value > 0);
  const e1rms = rows
    .map((row) => calculateEstimated1RM(row.weightKg, row.reps))
    .filter((value): value is number => value != null);
  const rpes = rows.map((row) => row.rpe).filter((value): value is number => value != null);
  const latest = rows.reduce((newest, row) => (row.createdAt > newest.createdAt ? row : newest));

  return {
    exerciseSlug: slug,
    exerciseName: latest.exerciseName || slug,
    sessions: new Set(rows.map((row) => row.sessionId)).size,
    totalSets: rows.length,
    totalReps: rows.reduce((sum, row) => sum + (row.reps ?? 0), 0),
    totalVolume: Number(
      rows.reduce((sum, row) => sum + calculateVolume(row.reps, row.weightKg), 0).toFixed(1),
    ),
    bestWeightKg: weights.length ? Math.max(...weights) : null,
    bestReps: reps.length ? Math.max(...reps) : null,
    bestEstimated1RMKg: e1rms.length ? Math.max(...e1rms) : null,
    averageRpe: calculateAverage(rpes),
    latest: {
      date: latest.createdAt,
      weightKg: latest.weightKg,
      reps: latest.reps,
      rpe: latest.rpe,
      estimated1RMKg: calculateEstimated1RM(latest.weightKg, latest.reps),
    },
  };
}

export async function getPerformanceOverviewData(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<PerformanceOverviewData> {
  const { sessions, logs } = await loadCompletedPerformance(supabase, userId);
  const exercises = [...new Set(logs.map((log) => log.exerciseSlug))]
    .map((slug) => aggregateExercisePerformance(logs, slug))
    .filter((value): value is ExercisePerformance => value !== null);
  const rpes = logs.map((log) => log.rpe).filter((value): value is number => value != null);

  return {
    sessions,
    logs,
    metrics: {
      workouts: sessions.length,
      totalVolume: Number(
        sessions.reduce((sum, session) => sum + session.totalVolume, 0).toFixed(1),
      ),
      totalDurationSeconds: sessions.reduce(
        (sum, session) => sum + (session.durationSeconds ?? 0),
        0,
      ),
      totalSets: logs.length,
      totalReps: logs.reduce((sum, log) => sum + (log.reps ?? 0), 0),
      averageRpe: calculateAverage(rpes),
    },
    exercises,
  };
}

export async function getExerciseProgressData(
  supabase: SupabaseClient<Database>,
  userId: string,
  exerciseSlug: string,
) {
  const { sessions, logs } = await loadCompletedPerformance(supabase, userId);
  const performance = aggregateExercisePerformance(logs, exerciseSlug);
  const sessionIds = new Set(sessions.map((session) => session.id));
  const points = logs
    .filter((log) => log.exerciseSlug === exerciseSlug && log.done && sessionIds.has(log.sessionId))
    .map((log) => ({
      date: log.createdAt,
      weightKg: log.weightKg,
      reps: log.reps,
      rpe: log.rpe,
      estimated1RMKg: calculateEstimated1RM(log.weightKg, log.reps),
    }));

  return {
    status: performance ? "READY" : "NO_DATA",
    performance,
    points,
  };
}

export async function getVolumeTrendData(supabase: SupabaseClient<Database>, userId: string) {
  const { sessions } = await loadCompletedPerformance(supabase, userId);

  return {
    status: "READY",
    points: sessions.map((session) => ({
      date: session.finishedAt,
      workout: session.title,
      volume: Number(session.totalVolume.toFixed(1)),
      durationSeconds: session.durationSeconds ?? 0,
    })),
  };
}

export async function getStrengthTrendData(supabase: SupabaseClient<Database>, userId: string) {
  const { logs } = await loadCompletedPerformance(supabase, userId);
  const byExercise = new Map<
    string,
    {
      exerciseSlug: string;
      exerciseName: string;
      date: string;
      estimated1RMKg: number;
    }[]
  >();

  for (const log of logs) {
    const e1rm = calculateEstimated1RM(log.weightKg, log.reps);
    if (e1rm == null) {
      continue;
    }

    const current = byExercise.get(log.exerciseSlug) ?? [];
    current.push({
      exerciseSlug: log.exerciseSlug,
      exerciseName: log.exerciseName,
      date: log.createdAt,
      estimated1RMKg: e1rm,
    });
    byExercise.set(log.exerciseSlug, current);
  }

  return {
    status: "READY",
    points: [...byExercise.values()].flatMap((points) =>
      points.sort((a, b) => a.date.localeCompare(b.date)).slice(-20),
    ),
  };
}
