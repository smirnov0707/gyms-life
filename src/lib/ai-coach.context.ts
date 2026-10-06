import { createCoachContext, type CoachContext } from "./ai-coach.contract";
import type { ActiveTrainingPlan } from "./active-plan.service";
import type { DeterministicPerformanceForecast } from "./forecast.schema";
import type { PerformanceOverviewData } from "./performance.service";

type CoachPlanInput = Pick<ActiveTrainingPlan, "id" | "title"> & {
  dayIndex?: number | null;
};

type CoachPerformanceInput = Pick<PerformanceOverviewData, "metrics" | "exercises">;

function performanceSignalsFor(forecast: DeterministicPerformanceForecast) {
  if (forecast.status === "learning") return [];
  return forecast.lifts.map((lift) => ({
    exerciseSlug: lift.exerciseSlug,
    exerciseName: lift.exerciseName,
    trend: lift.trend,
    evidenceStrength: lift.evidenceStrength,
    evidence: lift.evidence,
  }));
}

export function buildCoachContext(input: {
  userId: string;
  goal?: string | null;
  activePlan?: CoachPlanInput | null;
  performance: CoachPerformanceInput;
  performanceForecast: DeterministicPerformanceForecast;
  endurance?: CoachContext["endurance"];
}): CoachContext {
  return createCoachContext({
    user: { id: input.userId },
    generatedAt: new Date().toISOString(),
    goal: input.goal ?? null,
    activePlan: input.activePlan
      ? {
          id: input.activePlan.id,
          title: input.activePlan.title,
          dayIndex: input.activePlan.dayIndex ?? null,
        }
      : null,
    performance: {
      workouts: input.performance.metrics.workouts,
      totalVolumeKg: input.performance.metrics.totalVolume,
      totalSets: input.performance.metrics.totalSets,
      totalReps: input.performance.metrics.totalReps,
      averageRpe: input.performance.metrics.averageRpe,
    },
    performanceSignals: performanceSignalsFor(input.performanceForecast),
    endurance: input.endurance ?? { active: false, raceDistance: null, daysToRace: null, phase: null, readiness: null, evidenceLevel: null, adaptation: null, nextSession: null, postRun: null, prohibitedClaims: ["diagnosis", "injury_prediction_without_evidence", "guaranteed_race_time", "vo2max_without_measurement", "override_deterministic_training_decision"] },
    exercises: input.performance.exercises.map(({ totalVolume, ...exercise }) => ({
      ...exercise,
      totalVolumeKg: totalVolume,
    })),
  });
}
