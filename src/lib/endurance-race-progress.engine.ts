import type { EndurancePlanSession } from "./endurance-race-goal.schema";

export type CompletedRunEvidence = {
  planSessionKey?: string | null;
  distanceMeters: number | null;
  durationMinutes: number;
  perceivedEffort: number | null;
};

export type PlannedRunProgress =
  | { status: "unmatched"; completionRatio: null; reason: "missing_distance_target" | "missing_distance_evidence" }
  | {
      status: "completed" | "under_target" | "over_target";
      completionRatio: number;
      plannedDistanceMeters: number;
      completedDistanceMeters: number;
    };

const round2 = (value: number) => Math.round(value * 100) / 100;

export function evaluatePlannedRun(
  planned: EndurancePlanSession,
  completed: CompletedRunEvidence,
): PlannedRunProgress {
  if (planned.plannedDistanceMeters === null) {
    return { status: "unmatched", completionRatio: null, reason: "missing_distance_target" };
  }
  if (completed.distanceMeters === null || completed.distanceMeters <= 0) {
    return { status: "unmatched", completionRatio: null, reason: "missing_distance_evidence" };
  }
  const ratio = round2(completed.distanceMeters / planned.plannedDistanceMeters);
  return {
    status: ratio < 0.85 ? "under_target" : ratio > 1.15 ? "over_target" : "completed",
    completionRatio: ratio,
    plannedDistanceMeters: planned.plannedDistanceMeters,
    completedDistanceMeters: completed.distanceMeters,
  };
}

export type RaceWeekProgress = {
  plannedSessions: number;
  completedSessions: number;
  matchedSessions: number;
  observedRuns: number;
  plannedDistanceMeters: number;
  completedDistanceMeters: number;
  observedDistanceMeters: number;
  distanceCompletionRatio: number | null;
};

export function summarizeRaceWeek(input: {
  planned: readonly EndurancePlanSession[];
  completed: readonly CompletedRunEvidence[];
}): RaceWeekProgress {
  const plannedDistance = input.planned.reduce((sum, session) => sum + (session.plannedDistanceMeters ?? 0), 0);
  const plannedKeys = new Set(input.planned.flatMap((session) => session.sessionKey ? [session.sessionKey] : []));
  const matchedByKey = new Map<string, CompletedRunEvidence>();
  for (const run of input.completed) {
    if (!run.planSessionKey || !plannedKeys.has(run.planSessionKey) || matchedByKey.has(run.planSessionKey)) continue;
    matchedByKey.set(run.planSessionKey, run);
  }
  const matchedRuns = [...matchedByKey.values()];
  const completedDistance = matchedRuns.reduce((sum, run) => sum + (run.distanceMeters ?? 0), 0);
  const observedDistance = input.completed.reduce((sum, run) => sum + (run.distanceMeters ?? 0), 0);
  return {
    plannedSessions: input.planned.length,
    completedSessions: matchedRuns.length,
    matchedSessions: matchedRuns.length,
    observedRuns: input.completed.length,
    plannedDistanceMeters: plannedDistance,
    completedDistanceMeters: completedDistance,
    observedDistanceMeters: observedDistance,
    distanceCompletionRatio: plannedDistance > 0 ? round2(completedDistance / plannedDistance) : null,
  };
}
