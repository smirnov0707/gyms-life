import type { ExerciseCatalogItem } from "./exercise-catalog.schema";
import type { ActiveLifeContext } from "./life-context.schema";
import { adaptTrainingPlanDay } from "./training-guidance.service";
import type { TrainingPlanDay, TrainingPlanExercise } from "./training-plan.schema";
import {
  WorkoutExecutionSnapshotSchema,
  type WorkoutAdaptationReason,
  type WorkoutExecutionSnapshot,
} from "./workout-execution.schema";

type WorkoutExecutionInput = {
  day: TrainingPlanDay;
  readinessModifier: number;
  lifeContexts: readonly ActiveLifeContext[];
  exerciseCatalog: readonly ExerciseCatalogItem[];
};

type EquipmentConstraint = {
  allowed: Set<string>;
  sourceContextIds: string[];
  reason: WorkoutAdaptationReason;
};

/**
 * Curated movement-equivalent routes. Entries are intentionally sparse: an
 * unknown movement is omitted rather than being replaced by a same-muscle
 * guess. Catalog presence and available equipment are checked at runtime.
 */
const CURATED_SUBSTITUTIONS: Readonly<Record<string, readonly string[]>> = {
  "barbell-row": ["one-arm-db-row", "band-pulldown", "inverted-row"],
  "bench-press": ["dumbbell-press", "push-up"],
  deadlift: ["db-romanian-deadlift", "kb-deadlift", "glute-bridge"],
  "hip-thrust": ["db-hip-thrust", "glute-bridge"],
  "lat-pulldown": ["band-pulldown", "pull-up"],
  "leg-press": ["goblet-squat", "bodyweight-squat"],
  "overhead-press": ["db-shoulder-press", "pike-push-up"],
  "romanian-deadlift": ["db-romanian-deadlift", "glute-bridge"],
  squat: ["goblet-squat", "bodyweight-squat", "lunge"],
};

function canonicalEquipment(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const aliases: Readonly<Record<string, string>> = {
    bands: "band",
    dumbbells: "dumbbell",
    kettlebells: "kettlebell",
    pull_up_bar: "pullup_bar",
    resistance_band: "band",
  };
  return aliases[normalized] ?? normalized;
}

function activeContextsOf(
  contexts: readonly ActiveLifeContext[],
  kind: ActiveLifeContext["context"]["kind"],
): ActiveLifeContext[] {
  return contexts.filter((context) => context.context.kind === kind);
}

function equipmentConstraintFor(
  contexts: readonly ActiveLifeContext[],
): EquipmentConstraint | null {
  const limited = activeContextsOf(contexts, "equipment_limited");
  if (limited.length > 0) {
    const allowed = new Set(["bodyweight"]);
    for (const context of limited) {
      if (context.context.kind !== "equipment_limited") continue;
      for (const item of context.context.equipment) allowed.add(canonicalEquipment(item));
    }
    return {
      allowed,
      sourceContextIds: limited.map((context) => context.id),
      reason: "equipment_limit",
    };
  }

  const facilityClosed = activeContextsOf(contexts, "facility_closed");
  if (facilityClosed.length === 0) return null;
  return {
    allowed: new Set(["bodyweight"]),
    sourceContextIds: facilityClosed.map((context) => context.id),
    reason: "facility_closed",
  };
}

function createSubstitute(
  source: TrainingPlanExercise,
  candidate: ExerciseCatalogItem,
): TrainingPlanExercise {
  const note = `Adapted from ${source.name} for available equipment.`;
  return {
    ...source,
    slug: candidate.slug,
    name: candidate.name_en,
    notes: source.notes ? `${source.notes} ${note}` : note,
  };
}

function applyEquipmentConstraint(
  day: TrainingPlanDay,
  constraint: EquipmentConstraint | null,
  catalog: readonly ExerciseCatalogItem[],
): {
  workout: TrainingPlanDay;
  substitutions: { fromSlug: string; toSlug: string }[];
  omittedExerciseSlugs: string[];
  applied: boolean;
} {
  if (constraint === null) {
    return { workout: day, substitutions: [], omittedExerciseSlugs: [], applied: false };
  }

  const catalogBySlug = new Map(catalog.map((exercise) => [exercise.slug, exercise]));
  const usedSlugs = new Set<string>();
  const substitutions: { fromSlug: string; toSlug: string }[] = [];
  const omittedExerciseSlugs: string[] = [];
  const exercises: TrainingPlanExercise[] = [];

  for (const exercise of day.exercises) {
    const canonical = catalogBySlug.get(exercise.slug);
    if (canonical && constraint.allowed.has(canonicalEquipment(canonical.equipment))) {
      exercises.push(exercise);
      usedSlugs.add(exercise.slug);
      continue;
    }

    const candidates = CURATED_SUBSTITUTIONS[exercise.slug] ?? [];
    const replacement = candidates
      .map((slug) => catalogBySlug.get(slug))
      .find(
        (candidate) =>
          candidate !== undefined &&
          constraint.allowed.has(canonicalEquipment(candidate.equipment)) &&
          !usedSlugs.has(candidate.slug),
      );

    if (!replacement) {
      omittedExerciseSlugs.push(exercise.slug);
      continue;
    }

    exercises.push(createSubstitute(exercise, replacement));
    substitutions.push({ fromSlug: exercise.slug, toSlug: replacement.slug });
    usedSlugs.add(replacement.slug);
  }

  if (exercises.length === 0) {
    throw new Error("No safe workout exercises are available for the active equipment context.");
  }

  return {
    workout: { ...day, exercises },
    substitutions,
    omittedExerciseSlugs,
    applied: substitutions.length > 0 || omittedExerciseSlugs.length > 0,
  };
}

function timeBudgetFor(contexts: readonly ActiveLifeContext[]): {
  minutes: number | null;
  sourceContextIds: string[];
} {
  const limits = activeContextsOf(contexts, "time_limited").flatMap((context) =>
    context.context.kind === "time_limited"
      ? [{ id: context.id, minutes: context.context.minutes }]
      : [],
  );
  if (limits.length === 0) return { minutes: null, sourceContextIds: [] };
  const minutes = Math.min(...limits.map((limit) => limit.minutes));
  return {
    minutes,
    sourceContextIds: limits.filter((limit) => limit.minutes === minutes).map((limit) => limit.id),
  };
}

function reduceToTimeBudget(
  day: TrainingPlanDay,
  minutes: number | null,
): {
  workout: TrainingPlanDay;
  applied: boolean;
} {
  if (minutes === null || day.estimated_minutes <= minutes) return { workout: day, applied: false };

  const totalSets = day.exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
  const targetSets = Math.max(
    1,
    Math.min(totalSets, Math.floor((totalSets * minutes) / day.estimated_minutes)),
  );
  const allocated = day.exercises.map(() => 0);
  let remaining = targetSets;

  for (let setIndex = 0; remaining > 0; setIndex += 1) {
    let allocatedAny = false;
    for (
      let exerciseIndex = 0;
      exerciseIndex < day.exercises.length && remaining > 0;
      exerciseIndex += 1
    ) {
      const exercise = day.exercises[exerciseIndex]!;
      if (allocated[exerciseIndex]! >= exercise.sets || setIndex >= exercise.sets) continue;
      allocated[exerciseIndex] = allocated[exerciseIndex]! + 1;
      remaining -= 1;
      allocatedAny = true;
    }
    if (!allocatedAny) break;
  }

  const exercises = day.exercises.flatMap((exercise, index) => {
    const sets = allocated[index]!;
    return sets > 0 ? [{ ...exercise, sets }] : [];
  });
  const appliedSets = exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
  const estimatedMinutes = Math.max(
    5,
    Math.min(minutes, Math.ceil((day.estimated_minutes * appliedSets) / totalSets)),
  );

  return {
    workout: { ...day, exercises, estimated_minutes: estimatedMinutes },
    applied: appliedSets < totalSets,
  };
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

/**
 * Deterministically builds the only plan a workout session may execute. The
 * engine never asks an AI provider to invent substitutions or time estimates.
 */
export function buildWorkoutExecutionSnapshot(
  input: WorkoutExecutionInput,
): WorkoutExecutionSnapshot {
  const highStress = activeContextsOf(input.lifeContexts, "high_stress");
  const effectiveReadinessModifier =
    highStress.length > 0 ? Math.min(input.readinessModifier, 0.8) : input.readinessModifier;
  const readinessWorkout = adaptTrainingPlanDay(input.day, effectiveReadinessModifier);
  const readinessApplied = readinessWorkout.exercises.some(
    (exercise, index) => exercise.sets !== input.day.exercises[index]?.sets,
  );

  const equipmentConstraint = equipmentConstraintFor(input.lifeContexts);
  const equipment = applyEquipmentConstraint(
    readinessWorkout,
    equipmentConstraint,
    input.exerciseCatalog,
  );
  const time = timeBudgetFor(input.lifeContexts);
  const shortened = reduceToTimeBudget(equipment.workout, time.minutes);
  const reasons: WorkoutAdaptationReason[] = [];
  const sourceContextIds: string[] = [];

  if (readinessApplied) reasons.push("readiness");
  if (highStress.length > 0 && effectiveReadinessModifier < input.readinessModifier) {
    reasons.push("high_stress");
    sourceContextIds.push(...highStress.map((context) => context.id));
  }
  if (equipment.applied && equipmentConstraint !== null) {
    reasons.push(equipmentConstraint.reason);
    sourceContextIds.push(...equipmentConstraint.sourceContextIds);
  }
  if (shortened.applied) {
    reasons.push("time_limit");
    sourceContextIds.push(...time.sourceContextIds);
  }

  return WorkoutExecutionSnapshotSchema.parse({
    version: "1.0",
    workout: shortened.workout,
    adaptation: {
      version: "1.0",
      readinessModifier: effectiveReadinessModifier,
      reasons,
      sourceContextIds: unique(sourceContextIds),
      timeBudgetMinutes: shortened.applied ? time.minutes : null,
      substitutions: equipment.substitutions,
      omittedExerciseSlugs: equipment.omittedExerciseSlugs,
    },
  });
}
