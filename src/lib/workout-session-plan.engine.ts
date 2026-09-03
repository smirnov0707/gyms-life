import type { TrainingPlanDay } from "./training-plan.schema";
import { adaptTrainingPlanDay } from "./training-guidance.service";
import type { WorkoutSession } from "./workout-session.schema";

type WorkoutSessionExecutionSource = Pick<
  WorkoutSession,
  "dayIndex" | "adaptationModifier" | "workoutSnapshot"
>;

/**
 * Resolves the exact day a workout session is allowed to log and complete.
 *
 * New sessions carry an immutable execution snapshot, so later plan, readiness,
 * or life-context changes cannot rewrite a workout that is already in progress.
 * The legacy-plan fallback is only for historical sessions created before
 * snapshots existed.
 */
export function resolveWorkoutSessionDay(
  session: WorkoutSessionExecutionSource,
  legacyPlanDay: TrainingPlanDay | null,
): TrainingPlanDay | null {
  const plannedDay =
    session.workoutSnapshot?.workout ??
    (legacyPlanDay ? adaptTrainingPlanDay(legacyPlanDay, session.adaptationModifier) : null);

  if (plannedDay === null || session.dayIndex === null) return null;

  return plannedDay.day === session.dayIndex + 1 ? plannedDay : null;
}
