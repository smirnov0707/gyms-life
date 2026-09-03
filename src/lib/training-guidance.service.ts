import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { TrainingPlanDay } from "./training-plan.schema";
import { loadCompletedPerformance } from "./performance.service";
import { adaptSets } from "./readiness.engine";
import {
  buildExerciseTrainingGuidance,
  type ExerciseTrainingGuidance,
} from "./training-guidance.engine";
import { parseWorkoutGuidanceHistory } from "./training-guidance.schema";

export type WorkoutTrainingGuidance = {
  readinessModifier: number;
  exercises: ExerciseTrainingGuidance[];
};

export function adaptTrainingPlanDay(
  day: TrainingPlanDay,
  readinessModifier: number,
): TrainingPlanDay {
  return {
    ...day,
    exercises: day.exercises.map((exercise) => ({
      ...exercise,
      sets: adaptSets(exercise.sets, readinessModifier),
    })),
  };
}

export async function getWorkoutTrainingGuidance(
  supabase: SupabaseClient<Database>,
  userId: string,
  day: TrainingPlanDay,
  readinessModifier: number,
): Promise<WorkoutTrainingGuidance> {
  const { sessions, logs } = await loadCompletedPerformance(supabase, userId);
  const finishedAtBySessionId = new Map<string, string>();
  for (const session of sessions) {
    finishedAtBySessionId.set(session.id, session.finishedAt);
  }
  return {
    readinessModifier,
    exercises: day.exercises.map((exercise) => {
      const history = parseWorkoutGuidanceHistory(
        logs.flatMap((log) => {
          const finishedAt = finishedAtBySessionId.get(log.sessionId);
          if (!finishedAt || log.exerciseSlug !== exercise.slug) return [];
          return [
            {
              sessionId: log.sessionId,
              finishedAt,
              setNumber: log.setNumber,
              reps: log.reps,
              weightKg: log.weightKg,
              rpe: log.rpe,
            },
          ];
        }),
      );
      return buildExerciseTrainingGuidance({
        exerciseSlug: exercise.slug,
        plannedSets: exercise.sets,
        targetSets: exercise.sets,
        plannedReps: exercise.reps,
        readinessModifier,
        history,
      });
    }),
  };
}
