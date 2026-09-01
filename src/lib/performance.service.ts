import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { calculateAverage, calculateEstimated1RM, calculateVolume } from "./performance.engine";

export type PerformanceSetLog = { id: string; session_id: string; exercise_slug: string; exercise_name: string; set_number: number; reps: number | null; weight_kg: number | null; rpe: number | null; done: boolean; created_at: string };
export type PerformanceSession = { id: string; plan_id: string; day_index: number; title: string; started_at: string; finished_at: string | null; duration_seconds: number | null; total_volume: number | null };
export type ExercisePerformance = { exerciseSlug: string; exerciseName: string; sessions: number; totalSets: number; totalReps: number; totalVolume: number; bestWeightKg: number | null; bestReps: number | null; bestEstimated1RMKg: number | null; averageRpe: number | null; latest: { date: string; weightKg: number | null; reps: number | null; rpe: number | null; estimated1RMKg: number | null } | null };

export async function loadCompletedPerformance(supabase: SupabaseClient<Database>, userId: string) {
  const { data: sessions, error: sessionError } = await supabase.from("workout_sessions").select("id, plan_id, day_index, title, started_at, finished_at, duration_seconds, total_volume").eq("user_id", userId).not("finished_at", "is", null).order("finished_at", { ascending: true });
  if (sessionError) throw new Error(`Performance session lookup failed: ${sessionError.message}`);
  const sessionRows = (sessions ?? []) as PerformanceSession[];
  if (!sessionRows.length) return { sessions: [], logs: [] as PerformanceSetLog[] };
  const ids = sessionRows.map((session) => session.id);
  const { data: logs, error: logError } = await supabase.from("set_logs").select("id, session_id, exercise_slug, exercise_name, set_number, reps, weight_kg, rpe, done, created_at").eq("user_id", userId).in("session_id", ids).eq("done", true).order("created_at", { ascending: true });
  if (logError) throw new Error(`Performance set lookup failed: ${logError.message}`);
  return { sessions: sessionRows, logs: (logs ?? []) as PerformanceSetLog[] };
}

export function aggregateExercisePerformance(logs: PerformanceSetLog[], slug: string): ExercisePerformance | null {
  const rows = logs.filter((log) => log.exercise_slug === slug && log.done);
  if (!rows.length) return null;
  const exerciseName = rows.find((row) => row.exercise_name)?.exercise_name ?? slug;
  const rpes = rows.map((row) => row.rpe).filter((value): value is number => value != null);
  const weights = rows.map((row) => row.weight_kg).filter((value): value is number => value != null && value > 0);
  const reps = rows.map((row) => row.reps).filter((value): value is number => value != null && value > 0);
  const e1rms = rows.map((row) => calculateEstimated1RM(row.weight_kg, row.reps)).filter((value): value is number => value != null);
  const latest = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]!;
  return { exerciseSlug: slug, exerciseName, sessions: new Set(rows.map((row) => row.session_id)).size, totalSets: rows.length, totalReps: rows.reduce((sum, row) => sum + (row.reps ?? 0), 0), totalVolume: Number(rows.reduce((sum, row) => sum + calculateVolume(row.reps, row.weight_kg), 0).toFixed(1)), bestWeightKg: weights.length ? Math.max(...weights) : null, bestReps: reps.length ? Math.max(...reps) : null, bestEstimated1RMKg: e1rms.length ? Math.max(...e1rms) : null, averageRpe: calculateAverage(rpes), latest: { date: latest.created_at, weightKg: latest.weight_kg, reps: latest.reps, rpe: latest.rpe, estimated1RMKg: calculateEstimated1RM(latest.weight_kg, latest.reps) } };
}

export async function getPerformanceOverviewData(supabase: SupabaseClient<Database>, userId: string) {
  const { sessions, logs } = await loadCompletedPerformance(supabase, userId);
  const exercises = [...new Set(logs.map((log) => log.exercise_slug))].map((slug) => aggregateExercisePerformance(logs, slug)).filter((value): value is ExercisePerformance => value !== null);
  const rpes = logs.map((log) => log.rpe).filter((value): value is number => value != null);
  return { sessions, logs, metrics: { workouts: sessions.length, totalVolume: Number(sessions.reduce((sum, session) => sum + (session.total_volume ?? 0), 0).toFixed(1)), totalDurationSeconds: sessions.reduce((sum, session) => sum + (session.duration_seconds ?? 0), 0), totalSets: logs.length, totalReps: logs.reduce((sum, log) => sum + (log.reps ?? 0), 0), averageRpe: calculateAverage(rpes) }, exercises };
}
