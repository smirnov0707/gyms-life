import { getPerformanceOverview } from "./performance.functions";
import { getProgressIntelligence } from "./progress-intelligence.functions";
import { createCoachContext, type CoachContext } from "./ai-coach.contract";

export async function buildCoachContext(input: { userId: string; goal?: string | null; activePlan?: { id: string; title: string; dayIndex?: number | null } | null; supabase: Parameters<typeof getPerformanceOverview>[0] extends never ? never : any }): Promise<CoachContext> {
  const [performance, intelligence] = await Promise.all([
    getPerformanceOverview(),
    getProgressIntelligence(),
  ]);

  if (performance.status !== "READY") throw new Error("Performance context is unavailable");
  if (intelligence.status === "NO_DATA") {
    return createCoachContext({ user: { id: input.userId }, generatedAt: new Date().toISOString(), goal: input.goal ?? null, activePlan: input.activePlan ?? null, performance: { workouts: 0, totalVolumeKg: 0, totalSets: 0, totalReps: 0, averageRpe: null }, insights: [], exercises: [] });
  }

  return createCoachContext({
    user: { id: input.userId },
    generatedAt: new Date().toISOString(),
    goal: input.goal ?? null,
    activePlan: input.activePlan ?? null,
    performance: { workouts: performance.metrics.workouts, totalVolumeKg: performance.metrics.totalVolume, totalSets: performance.metrics.totalSets, totalReps: performance.metrics.totalReps, averageRpe: performance.metrics.averageRpe },
    insights: intelligence.insights.map(({ exerciseSlug, exerciseName, insight }) => ({ exerciseSlug, exerciseName, signal: insight.signal, confidence: insight.confidence, evidence: insight.evidence, explanation: insight.explanation, recommendation: insight.recommendation })),
    exercises: performance.exercises.map((exercise) => ({ ...exercise, totalVolumeKg: exercise.totalVolume })),
  });
}
