import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/integrations/supabase/types";
import { calculateAverage, calculateEstimated1RM, calculateVolume } from "./performance.engine";

export type PerformanceSetLog = Pick<
  Tables<"set_logs">,
  | "id"
  | "session_id"
  | "exercise_slug"
  | "exercise_name"
  | "set_number"
  | "reps"
  | "weight_kg"
  | "rpe"
  | "done"
  | "created_at"
>;

export type PerformanceSession = Pick<
  Tables<"workout_sessions">,
  | "id"
  | "plan_id"
  | "day_index"
  | "title"
  | "started_at"
  | "finished_at"
  | "duration_seconds"
  | "total_volume"
>;

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
    .select(
      "id, plan_id, day_index, title, started_at, finished_at, duration_seconds, total_volume",
    )
    .eq("user_id", userId)
    .not("finished_at", "is", null)
    .order("finished_at", { ascending: true });

  if (sessionError) {
    throw new Error("Performance session lookup failed: " + sessionError.message);
  }

  const sessionRows = sessions ?? [];
  if (!sessionRows.length) {
    return { sessions: [], logs: [] };
  }

  const ids = sessionRows.map((session) => session.id);
  const { data: logs, error: logError } = await supabase
    .from("set_logs")
    .select(
      "id, session_id, exercise_slug, exercise_name, set_number, reps, weight_kg, rpe, done, created_at",
    )
    .eq("user_id", userId)
    .in("session_id", ids)
    .eq("done", true)
    .order("created_at", { ascending: true });

  if (logError) {
    throw new Error("Performance set lookup failed: " + logError.message);
  }

  return { sessions: sessionRows, logs: logs ?? [] };
}

export function aggregateExercisePerformance(
  logs: PerformanceSetLog[],
  slug: string,
): ExercisePerformance | null {
  const rows = logs.filter((log) => log.exercise_slug === slug && log.done);
  if (!rows.length) {
    return null;
  }

  const weights = rows
    .map((row) => row.weight_kg)
    .filter((value): value is number => value != null && value > 0);
  const reps = rows
    .map((row) => row.reps)
    .filter((value): value is number => value != null && value > 0);
  const e1rms = rows
    .map((row) => calculateEstimated1RM(row.weight_kg, row.reps))
    .filter((value): value is number => value != null);
  const rpes = rows.map((row) => row.rpe).filter((value): value is number => value != null);
  const latest = rows.reduce((newest, row) => (row.created_at > newest.created_at ? row : newest));

  return {
    exerciseSlug: slug,
    exerciseName: latest.exercise_name || slug,
    sessions: new Set(rows.map((row) => row.session_id)).size,
    totalSets: rows.length,
    totalReps: rows.reduce((sum, row) => sum + (row.reps ?? 0), 0),
    totalVolume: Number(
      rows.reduce((sum, row) => sum + calculateVolume(row.reps, row.weight_kg), 0).toFixed(1),
    ),
    bestWeightKg: weights.length ? Math.max(...weights) : null,
    bestReps: reps.length ? Math.max(...reps) : null,
    bestEstimated1RMKg: e1rms.length ? Math.max(...e1rms) : null,
    averageRpe: calculateAverage(rpes),
    latest: {
      date: latest.created_at,
      weightKg: latest.weight_kg,
      reps: latest.reps,
      rpe: latest.rpe,
      estimated1RMKg: calculateEstimated1RM(latest.weight_kg, latest.reps),
    },
  };
}

export async function getPerformanceOverviewData(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<PerformanceOverviewData> {
  const { sessions, logs } = await loadCompletedPerformance(supabase, userId);
  const exercises = [...new Set(logs.map((log) => log.exercise_slug))]
    .map((slug) => aggregateExercisePerformance(logs, slug))
    .filter((value): value is ExercisePerformance => value !== null);
  const rpes = logs.map((log) => log.rpe).filter((value): value is number => value != null);

  return {
    sessions,
    logs,
    metrics: {
      workouts: sessions.length,
      totalVolume: Number(
        sessions.reduce((sum, session) => sum + session.total_volume, 0).toFixed(1),
      ),
      totalDurationSeconds: sessions.reduce(
        (sum, session) => sum + (session.duration_seconds ?? 0),
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
    .filter(
      (log) => log.exercise_slug === exerciseSlug && log.done && sessionIds.has(log.session_id),
    )
    .map((log) => ({
      date: log.created_at,
      weightKg: log.weight_kg,
      reps: log.reps,
      rpe: log.rpe,
      estimated1RMKg: calculateEstimated1RM(log.weight_kg, log.reps),
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
    points: sessions.flatMap((session) =>
      session.finished_at === null
        ? []
        : [
            {
              date: session.finished_at,
              workout: session.title,
              volume: Number(session.total_volume.toFixed(1)),
              durationSeconds: session.duration_seconds ?? 0,
            },
          ],
    ),
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
    const e1rm = calculateEstimated1RM(log.weight_kg, log.reps);
    if (e1rm == null) {
      continue;
    }

    const current = byExercise.get(log.exercise_slug) ?? [];
    current.push({
      exerciseSlug: log.exercise_slug,
      exerciseName: log.exercise_name,
      date: log.created_at,
      estimated1RMKg: e1rm,
    });
    byExercise.set(log.exercise_slug, current);
  }

  return {
    status: "READY",
    points: [...byExercise.values()].flatMap((points) =>
      points.sort((a, b) => a.date.localeCompare(b.date)).slice(-20),
    ),
  };
}
