import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  analyzeExerciseProgress,
  type ExercisePoint,
} from "./progress-intelligence.engine";
import { calculateEstimated1RM } from "./performance.engine";

export type ProgressInsight = {
  exerciseSlug: string;
  exerciseName: string;
  insight: ReturnType<typeof analyzeExerciseProgress>;
};

export type ProgressIntelligenceData = {
  status: "READY" | "NO_DATA";
  generatedAt: string;
  insights: ProgressInsight[];
};

export async function loadProgressPoints(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  const { data, error } = await supabase
    .from("set_logs")
    .select(
      "exercise_slug, exercise_name, reps, weight_kg, rpe, done, created_at",
    )
    .eq("user_id", userId)
    .eq("done", true)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error("Progress intelligence lookup failed: " + error.message);
  }

  return (data ?? []).map((row) => ({
    exerciseSlug: row.exercise_slug,
    exerciseName: row.exercise_name,
    date: row.created_at,
    weightKg: row.weight_kg,
    reps: row.reps,
    rpe: row.rpe,
    estimated1RMKg: calculateEstimated1RM(row.weight_kg, row.reps),
    done: row.done,
  }));
}

export async function getProgressIntelligenceData(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<ProgressIntelligenceData> {
  const rows = await loadProgressPoints(supabase, userId);
  const byExercise = new Map<string, ExercisePoint[]>();

  for (const row of rows) {
    const points = byExercise.get(row.exerciseSlug) ?? [];
    points.push(row);
    byExercise.set(row.exerciseSlug, points);
  }

  const insights: ProgressInsight[] = [...byExercise.entries()].map(
    ([exerciseSlug, points]) => ({
      exerciseSlug,
      exerciseName:
        rows.find((row) => row.exerciseSlug === exerciseSlug)?.exerciseName ??
        exerciseSlug,
      insight: analyzeExerciseProgress(points),
    }),
  );

  return {
    status: insights.length ? "READY" : "NO_DATA",
    generatedAt: new Date().toISOString(),
    insights,
  };
}
