import { createCoachContext, type CoachContext } from "./ai-coach.contract";

type PerformanceSummary = { workouts: number; totalVolume: number; totalSets: number; totalReps: number; averageRpe: number | null; exercises: Array<{ exerciseSlug: string; exerciseName: string; sessions: number; totalSets: number; totalReps: number; totalVolume: number; bestWeightKg: number | null; bestReps: number | null; bestEstimated1RMKg: number | null; averageRpe: number | null; latest: { date: string; weightKg: number | null; reps: number | null; rpe: number | null; estimated1RMKg: number | null } | null; }> };
type ProgressInsight = { exerciseSlug: string; exerciseName: string; insight: { signal: "PROGRESSING" | "STAGNATING" | "FATIGUE_RISK" | "INSUFFICIENT_DATA"; confidence: number; evidence: Array<{ metric: string; value: string | number }>; explanation: string; recommendation: string; } };

export function buildCoachContext(input: { userId: string; goal?: string | null; activePlan?: { id: string; title: string; dayIndex?: number | null } | null; performance: PerformanceSummary; insights: ProgressInsight[] }): CoachContext {
  return createCoachContext({
    user: { id: input.userId }, generatedAt: new Date().toISOString(), goal: input.goal ?? null, activePlan: input.activePlan ?? null,
    performance: { workouts: input.performance.workouts, totalVolumeKg: input.performance.totalVolume, totalSets: input.performance.totalSets, totalReps: input.performance.totalReps, averageRpe: input.performance.averageRpe },
    insights: input.insights.map(({ exerciseSlug, exerciseName, insight }) => ({ exerciseSlug, exerciseName, signal: insight.signal, confidence: insight.confidence, evidence: insight.evidence, explanation: insight.explanation, recommendation: insight.recommendation })),
    exercises: input.performance.exercises.map((exercise) => ({ ...exercise, totalVolumeKg: exercise.totalVolume })),
  });
}
