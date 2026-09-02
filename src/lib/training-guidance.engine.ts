import { adaptSets } from "./readiness.engine";
import type { WorkoutGuidanceHistorySet } from "./training-guidance.schema";

export type TrainingGuidanceAction =
  "INCREASE_LOAD" | "MAINTAIN_LOAD" | "REDUCE_LOAD" | "LOG_BASELINE";

export type TrainingGuidanceReason =
  | "READY_TO_PROGRESS"
  | "RECOVERY_REDUCTION"
  | "HIGH_EFFORT_MISSED_TARGET"
  | "MAINTAIN_PROGRESS"
  | "NO_WEIGHTED_HISTORY";

export type ExerciseTrainingGuidance = {
  exerciseSlug: string;
  action: TrainingGuidanceAction;
  reason: TrainingGuidanceReason;
  suggestedWeightKg: number | null;
  adjustedSets: number;
  targetRepRange: { min: number; max: number } | null;
  completedSessions: number;
  previous: { weightKg: number; reps: number | null; rpe: number | null } | null;
};

type ExerciseTrainingGuidanceInput = {
  exerciseSlug: string;
  plannedSets: number;
  plannedReps: string;
  readinessModifier: number;
  history: WorkoutGuidanceHistorySet[];
};

type SessionHistory = {
  id: string;
  finishedAt: string;
  sets: WorkoutGuidanceHistorySet[];
};

function parseRepRange(value: string): { min: number; max: number } | null {
  const values = Array.from(value.matchAll(/\d+/g), (match) => Number(match[0])).filter(
    (reps) => Number.isInteger(reps) && reps > 0 && reps <= 100,
  );
  if (!values.length) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}

function roundToPlateIncrement(weightKg: number): number {
  return Math.round(weightKg * 2) / 2;
}

function progressionIncrement(weightKg: number): number {
  if (weightKg < 20) return 1;
  if (weightKg < 100) return 2.5;
  return 5;
}

function groupCompletedSessions(history: WorkoutGuidanceHistorySet[]): SessionHistory[] {
  const sessions = new Map<string, SessionHistory>();
  for (const set of history) {
    const existing = sessions.get(set.sessionId);
    if (existing) {
      existing.sets.push(set);
      continue;
    }
    sessions.set(set.sessionId, { id: set.sessionId, finishedAt: set.finishedAt, sets: [set] });
  }
  return [...sessions.values()].sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
}

function workingSets(session: SessionHistory | undefined): WorkoutGuidanceHistorySet[] {
  return (session?.sets ?? [])
    .filter((set) => set.weightKg !== null && set.reps !== null)
    .sort((a, b) => a.setNumber - b.setNumber);
}

export function buildExerciseTrainingGuidance(
  input: ExerciseTrainingGuidanceInput,
): ExerciseTrainingGuidance {
  const targetRepRange = parseRepRange(input.plannedReps);
  const adjustedSets = adaptSets(input.plannedSets, input.readinessModifier);
  const sessions = groupCompletedSessions(input.history);
  const lastWorkingSets = workingSets(sessions[0]);
  const baseline = lastWorkingSets[0] ?? null;
  const baselineWeightKg = baseline?.weightKg ?? null;
  const previous =
    baseline && baselineWeightKg !== null
      ? { weightKg: baselineWeightKg, reps: baseline.reps, rpe: baseline.rpe }
      : null;

  if (!baseline || baselineWeightKg === null) {
    return {
      exerciseSlug: input.exerciseSlug,
      action: "LOG_BASELINE",
      reason: "NO_WEIGHTED_HISTORY",
      suggestedWeightKg: null,
      adjustedSets,
      targetRepRange,
      completedSessions: sessions.length,
      previous,
    };
  }

  if (input.readinessModifier <= 0.8) {
    return {
      exerciseSlug: input.exerciseSlug,
      action: "REDUCE_LOAD",
      reason: "RECOVERY_REDUCTION",
      suggestedWeightKg: roundToPlateIncrement(baselineWeightKg * input.readinessModifier),
      adjustedSets,
      targetRepRange,
      completedSessions: sessions.length,
      previous,
    };
  }

  const plannedWorkingSets = lastWorkingSets.slice(0, input.plannedSets);
  const allSetsReachedTopOfRange =
    targetRepRange !== null &&
    plannedWorkingSets.length === input.plannedSets &&
    plannedWorkingSets.every(
      (set) =>
        set.reps !== null && set.reps >= targetRepRange.max && set.rpe !== null && set.rpe <= 8,
    );
  if (sessions.length >= 2 && allSetsReachedTopOfRange) {
    return {
      exerciseSlug: input.exerciseSlug,
      action: "INCREASE_LOAD",
      reason: "READY_TO_PROGRESS",
      suggestedWeightKg: roundToPlateIncrement(
        baselineWeightKg + progressionIncrement(baselineWeightKg),
      ),
      adjustedSets,
      targetRepRange,
      completedSessions: sessions.length,
      previous,
    };
  }

  const missedTargetAtHighEffort =
    targetRepRange !== null &&
    plannedWorkingSets.length === input.plannedSets &&
    plannedWorkingSets.some(
      (set) =>
        set.reps !== null && set.reps < targetRepRange.min && set.rpe !== null && set.rpe >= 9,
    );
  if (missedTargetAtHighEffort) {
    return {
      exerciseSlug: input.exerciseSlug,
      action: "REDUCE_LOAD",
      reason: "HIGH_EFFORT_MISSED_TARGET",
      suggestedWeightKg: roundToPlateIncrement(baselineWeightKg * 0.95),
      adjustedSets,
      targetRepRange,
      completedSessions: sessions.length,
      previous,
    };
  }

  return {
    exerciseSlug: input.exerciseSlug,
    action: "MAINTAIN_LOAD",
    reason: "MAINTAIN_PROGRESS",
    suggestedWeightKg: baselineWeightKg,
    adjustedSets,
    targetRepRange,
    completedSessions: sessions.length,
    previous,
  };
}
