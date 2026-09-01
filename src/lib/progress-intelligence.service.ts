import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { analyzeExerciseProgress, type ExercisePoint } from "./progress-intelligence.engine";
import { calculateEstimated1RM } from "./performance.engine";

export async function loadProgressPoints(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase.from("set_logs").select("exercise_slug, exercise_name, reps, weight_kg, rpe, done, created_at").eq("user_id", userId).eq("done", true).order("created_at", { ascending: true });
  if (error) throw new Error(`Progress intelligence lookup failed: ${error.message}`);
  return (data ?? []).map((row) => ({ exerciseSlug: row.exercise_slug, exerciseName: row.exercise_name, date: row.created_at, weightKg: row.weight_kg, reps: row.reps, rpe: row.rpe, estimated1RMKg: calculateEstimated1RM(row.weight_kg, row.reps), done: row.done }));
}

export async function getProgressIntelligenceData(supabase: SupabaseClient<Database>, userId: string) {
  const rows = await loadProgressPoints(supabase, userId);
  const byExercise = new Map<string, ExercisePoint[]>();
  for (const row of rows) byExercise.set(row.exerciseSlug, [...(byExercise.get(row.exerciseSlug) ?? []), row]);
  const insights = [...byExercise.entries()].map(([exerciseSlug, points]) => ({ exerciseSlug, exerciseName: rows.find((row) => row.exerciseSlug === exerciseSlug)?.exerciseName ?? exerciseSlug, insight: analyzeExerciseProgress(points) }));
  return { status: insights.length ? "READY" as const : "NO_DATA" as const, generatedAt: new Date().toISOString(), insights };
}
