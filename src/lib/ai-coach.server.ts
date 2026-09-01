import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createCoachContext, type CoachContext } from "./ai-coach.contract";
import { loadCompletedPerformanceData } from "./performance.data";
import { analyzeExerciseProgress, type ExercisePoint } from "./progress-intelligence.engine";

export async function assembleCoachContext(args: { supabase: SupabaseClient<Database>; userId: string; goal?: string | null; activePlan?: { id: string; title: string; dayIndex?: number | null } | null }): Promise<CoachContext> {
  const { sessions, logs } = await loadCompletedPerformanceData(args.supabase, args.userId);
  const byExercise = new Map<string, ExercisePoint[]>();
  for (const row of logs) {
    const points = byExercise.get(row.exercise_slug) ?? [];
    points.push({ date: row.created_at, weightKg: row.weight_kg, reps: row.reps, rpe: row.rpe, estimated1RMKg: row.weight_kg != null && row.reps != null && row.weight_kg > 0 && row.reps > 0 ? Number((row.weight_kg * (1 + row.reps / 30)).toFixed(1)) : null });
    byExercise.set(row.exercise_slug, points);
  }
  const insights = [...byExercise.entries()].map(([exerciseSlug, points]) => ({ exerciseSlug, exerciseName: logs.find((row) => row.exercise_slug === exerciseSlug)?.exercise_name ?? exerciseSlug, insight: analyzeExerciseProgress(points) }));
  const totalVolumeKg = Number(sessions.reduce((sum, session) => sum + (session.total_volume ?? 0), 0).toFixed(1));
  const rpes = logs.map((row) => row.rpe).filter((value): value is number => value != null);
  const averageRpe = rpes.length ? Number((rpes.reduce((a, b) => a + b, 0) / rpes.length).toFixed(1)) : null;
  const exercises = [...byExercise.entries()].map(([exerciseSlug]) => {
    const rows = logs.filter((row) => row.exercise_slug === exerciseSlug);
    const e1rms = rows.map((row) => row.weight_kg != null && row.reps != null && row.weight_kg > 0 && row.reps > 0 ? Number((row.weight_kg * (1 + row.reps / 30)).toFixed(1)) : null).filter((v): v is number => v != null);
    const weights = rows.map((row) => row.weight_kg).filter((v): v is number => v != null && v > 0);
    const reps = rows.map((row) => row.reps).filter((v): v is number => v != null && v > 0);
    const latest = rows.at(-1);
    const exerciseRpes = rows.map((row) => row.rpe).filter((v): v is number => v != null);
    return { exerciseSlug, exerciseName: latest?.exercise_name ?? exerciseSlug, sessions: new Set(rows.map((row) => row.session_id)).size, totalSets: rows.length, totalReps: rows.reduce((s, row) => s + (row.reps ?? 0), 0), totalVolumeKg: Number(rows.reduce((s, row) => s + (row.reps ?? 0) * (row.weight_kg ?? 0), 0).toFixed(1)), bestWeightKg: weights.length ? Math.max(...weights) : null, bestReps: reps.length ? Math.max(...reps) : null, bestEstimated1RMKg: e1rms.length ? Math.max(...e1rms) : null, averageRpe: exerciseRpes.length ? Number((exerciseRpes.reduce((a, b) => a + b, 0) / exerciseRpes.length).toFixed(1)) : null, latest: latest ? { date: latest.created_at, weightKg: latest.weight_kg, reps: latest.reps, rpe: latest.rpe, estimated1RMKg: latest.weight_kg != null && latest.reps != null && latest.weight_kg > 0 && latest.reps > 0 ? Number((latest.weight_kg * (1 + latest.reps / 30)).toFixed(1)) : null } : null };
  });
  return createCoachContext({ user: { id: args.userId }, generatedAt: new Date().toISOString(), goal: args.goal ?? null, activePlan: args.activePlan ?? null, performance: { workouts: sessions.length, totalVolumeKg, totalSets: logs.length, totalReps: logs.reduce((s, row) => s + (row.reps ?? 0), 0), averageRpe }, insights: insights.map(({ exerciseSlug, exerciseName, insight }) => ({ exerciseSlug, exerciseName, signal: insight.signal, confidence: insight.confidence, evidence: insight.evidence, explanation: insight.explanation, recommendation: insight.recommendation })), exercises });
}
