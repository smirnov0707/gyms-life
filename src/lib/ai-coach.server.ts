import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createCoachContext, type CoachContext } from "./ai-coach.contract";
import { getPerformanceOverview } from "./performance.functions";
import { getProgressIntelligence } from "./progress-intelligence.functions";

export async function assembleCoachContext(args: {
  supabase: SupabaseClient<Database>;
  userId: string;
  goal?: string | null;
  activePlan?: { id: string; title: string; dayIndex?: number | null } | null;
}): Promise<CoachContext> {
  const [performance, intelligence] = await Promise.all([getPerformanceOverview(), getProgressIntelligence()]);
  if (performance.status !== "READY") throw new Error("Performance context unavailable");
  return createCoachContext({
    user: { id: args.userId },
    generatedAt: new Date().toISOString(),
    goal: args.goal ?? null,
    activePlan: args.activePlan ?? null,
    performance: { workouts: performance.metrics.workouts, totalVolumeKg: performance.metrics.totalVolume, totalSets: performance.metrics.totalSets, totalReps: performance.metrics.totalReps, averageRpe: performance.metrics.averageRpe },
    insights: intelligence.status === "READY" ? intelligence.insights.map(({ exerciseSlug, exerciseName, insight }) => ({ exerciseSlug, exerciseName, signal: insight.signal, confidence: insight.confidence, evidence: insight.evidence, explanation: insight.explanation, recommendation: insight.recommendation })) : [],
    exercises: performance.exercises.map((exercise) => ({ ...exercise, totalVolumeKg: exercise.totalVolume })),
  });
}
