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
    if (session.finished_at !== null) {
      finishedAtBySessionId.set(session.id, session.finished_at);
    }
  }
  return {
    readinessModifier,
    exercises: day.exercises.map((exercise) => {
      const history = parseWorkoutGuidanceHistory(
        logs.flatMap((log) => {
          const finishedAt = finishedAtBySessionId.get(log.session_id);
          if (!finishedAt || log.exercise_slug !== exercise.slug) return [];
          return [
            {
              sessionId: log.session_id,
              finishedAt,
              setNumber: log.set_number,
              reps: log.reps,
              weightKg: log.weight_kg,
              rpe: log.rpe,
            },
          ];
        }),
      );
      return buildExerciseTrainingGuidance({
        exerciseSlug: exercise.slug,
        plannedSets: exercise.sets,
        plannedReps: exercise.reps,
        readinessModifier,
        history,
      });
    }),
  };
}
