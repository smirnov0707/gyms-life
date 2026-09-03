export type WorkoutStartAvailability =
  { status: "ready"; nextWorkoutDay: number } | { status: "unavailable" };

export type WorkoutStartRejection =
  "workout_unavailable" | "not_next_workout" | "readiness_required";

export type WorkoutStartGateResult =
  { allowed: true } | { allowed: false; reason: WorkoutStartRejection };

/**
 * Server-side execution gate for a new workout. It intentionally does not
 * repeat the decision engine: it enforces only hard entry invariants so a
 * direct URL, stale UI, or an AI-generated link cannot bypass them.
 */
export function evaluateWorkoutStartGate(input: {
  availability: WorkoutStartAvailability;
  requestedDay: number;
  hasOpenSession: boolean;
  hasTodayReadiness: boolean;
}): WorkoutStartGateResult {
  if (input.availability.status !== "ready") {
    return { allowed: false, reason: "workout_unavailable" };
  }
  if (input.availability.nextWorkoutDay !== input.requestedDay) {
    return { allowed: false, reason: "not_next_workout" };
  }
  if (!input.hasOpenSession && !input.hasTodayReadiness) {
    return { allowed: false, reason: "readiness_required" };
  }
  return { allowed: true };
}
