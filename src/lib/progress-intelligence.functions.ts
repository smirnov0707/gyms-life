import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { analyzeExerciseProgress, type ExercisePoint } from "./progress-intelligence.engine";

const SET_SELECT = "exercise_slug, exercise_name, reps, weight_kg, rpe, done, created_at";

type SetRow = ExercisePoint & { exerciseSlug: string; exerciseName: string; done: boolean };

async function loadPoints(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase.from("set_logs").select(SET_SELECT).eq("user_id", userId).eq("done", true).order("created_at", { ascending: true });
  if (error) throw new Error(`Progress intelligence lookup failed: ${error.message}`);
  return (data ?? []).map((row) => ({ exerciseSlug: row.exercise_slug, exerciseName: row.exercise_name, date: row.created_at, weightKg: row.weight_kg, reps: row.reps, rpe: row.rpe, estimated1RMKg: row.weight_kg != null && row.reps != null && row.weight_kg > 0 && row.reps > 0 ? Number((row.weight_kg * (1 + row.reps / 30)).toFixed(1)) : null, done: row.done })) as SetRow[];
}

export const getProgressIntelligence = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const rows = await loadPoints(context.supabase, context.userId);
  const byExercise = new Map<string, ExercisePoint[]>();
  for (const row of rows) byExercise.set(row.exerciseSlug, [...(byExercise.get(row.exerciseSlug) ?? []), row]);
  const insights = [...byExercise.entries()].map(([exerciseSlug, points]) => ({ exerciseSlug, exerciseName: rows.find((row) => row.exerciseSlug === exerciseSlug)?.exerciseName ?? exerciseSlug, insight: analyzeExerciseProgress(points) }));
  return { status: insights.length ? "READY" as const : "NO_DATA" as const, generatedAt: new Date().toISOString(), insights };
});
