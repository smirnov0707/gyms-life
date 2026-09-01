import {
  createCoachContext,
  type CoachContext,
} from "./ai-coach.contract";
import type { ActiveTrainingPlan } from "./active-plan.service";
import type { PerformanceOverviewData } from "./performance.service";
import type { ProgressInsight } from "./progress-intelligence.service";

type CoachPlanInput = Pick<ActiveTrainingPlan, "id" | "title"> & {
  dayIndex?: number | null;
};

type CoachPerformanceInput = Pick<
  PerformanceOverviewData,
  "metrics" | "exercises"
>;

export function buildCoachContext(input: {
  userId: string;
  goal?: string | null;
  activePlan?: CoachPlanInput | null;
  performance: CoachPerformanceInput;
  insights: ProgressInsight[];
}): CoachContext {
  return createCoachContext({
    user: { id: input.userId },
    generatedAt: new Date().toISOString(),
    goal: input.goal ?? null,
    activePlan: input.activePlan ?? null,
    performance: {
      workouts: input.performance.metrics.workouts,
      totalVolumeKg: input.performance.metrics.totalVolume,
      totalSets: input.performance.metrics.totalSets,
      totalReps: input.performance.metrics.totalReps,
      averageRpe: input.performance.metrics.averageRpe,
    },
    insights: input.insights.map(
      ({ exerciseSlug, exerciseName, insight }) => ({
        exerciseSlug,
        exerciseName,
        signal: insight.signal,
        confidence: insight.confidence,
        evidence: insight.evidence,
        explanation: insight.explanation,
        recommendation: insight.recommendation,
      }),
    ),
    exercises: input.performance.exercises.map(
      ({ totalVolume, ...exercise }) => ({
        ...exercise,
        totalVolumeKg: totalVolume,
      }),
    ),
  });
}
