import { describe, expect, it } from "vitest";
import type { ExerciseCatalogItem } from "./exercise-catalog.schema";
import type { ActiveLifeContext } from "./life-context.schema";
import type { TrainingPlanDay } from "./training-plan.schema";
import {
  buildWorkoutExecutionSnapshot,
  hasActiveWorkoutSafetyConstraint,
} from "./workout-execution.engine";

const day: TrainingPlanDay = {
  day: 1,
  title: "Full body",
  focus: "Strength",
  warmup: "Walk",
  cooldown: "Stretch",
  estimated_minutes: 60,
  exercises: [
    { slug: "squat", name: "Squat", sets: 3, reps: "8", rest_seconds: 90, notes: "" },
    {
      slug: "bench-press",
      name: "Bench press",
      sets: 3,
      reps: "8",
      rest_seconds: 90,
      notes: "",
    },
    { slug: "barbell-row", name: "Barbell row", sets: 3, reps: "8", rest_seconds: 90, notes: "" },
  ],
};

const catalog: ExerciseCatalogItem[] = [
  {
    slug: "squat",
    name_en: "Barbell Back Squat",
    name_lt: "Pritūpimai su štanga",
    muscle_group: "legs",
    equipment: "barbell",
    location: "gym",
    difficulty: "intermediate",
  },
  {
    slug: "bench-press",
    name_en: "Barbell Bench Press",
    name_lt: "Spaudimas gulint",
    muscle_group: "chest",
    equipment: "barbell",
    location: "gym",
    difficulty: "intermediate",
  },
  {
    slug: "barbell-row",
    name_en: "Barbell Row",
    name_lt: "Irklavimas su štanga",
    muscle_group: "back",
    equipment: "barbell",
    location: "gym",
    difficulty: "intermediate",
  },
  {
    slug: "goblet-squat",
    name_en: "Goblet Squat",
    name_lt: "Goblet pritūpimai",
    muscle_group: "legs",
    equipment: "dumbbell",
    location: "both",
    difficulty: "beginner",
  },
  {
    slug: "dumbbell-press",
    name_en: "Dumbbell Bench Press",
    name_lt: "Spaudimas su hanteliais",
    muscle_group: "chest",
    equipment: "dumbbell",
    location: "both",
    difficulty: "beginner",
  },
  {
    slug: "one-arm-db-row",
    name_en: "One-Arm Dumbbell Row",
    name_lt: "Irklavimas viena ranka",
    muscle_group: "back",
    equipment: "dumbbell",
    location: "both",
    difficulty: "beginner",
  },
  {
    slug: "bodyweight-squat",
    name_en: "Bodyweight Squat",
    name_lt: "Pritūpimai su kūno svoriu",
    muscle_group: "legs",
    equipment: "bodyweight",
    location: "both",
    difficulty: "beginner",
  },
  {
    slug: "push-up",
    name_en: "Push-Up",
    name_lt: "Atsispaudimai",
    muscle_group: "chest",
    equipment: "bodyweight",
    location: "both",
    difficulty: "beginner",
  },
  {
    slug: "inverted-row",
    name_en: "Inverted Row",
    name_lt: "Horizonali trauka",
    muscle_group: "back",
    equipment: "bodyweight",
    location: "both",
    difficulty: "beginner",
  },
];

function context(contextValue: ActiveLifeContext["context"]): ActiveLifeContext {
  return {
    id: "00000000-0000-4000-8000-000000000100",
    content: "Temporary context",
    expiresAt: "2026-09-04T00:00:00.000Z",
    context: contextValue,
  };
}

describe("buildWorkoutExecutionSnapshot", () => {
  it("builds a shorter, auditable session while retaining plan order", () => {
    const snapshot = buildWorkoutExecutionSnapshot({
      day,
      readinessModifier: 1,
      lifeContexts: [context({ kind: "time_limited", minutes: 30 })],
      exerciseCatalog: [],
    });

    expect(snapshot.workout.estimated_minutes).toBeLessThanOrEqual(30);
    expect(snapshot.workout.exercises.map((exercise) => exercise.slug)).toEqual([
      "squat",
      "bench-press",
      "barbell-row",
    ]);
    expect(snapshot.workout.exercises.map((exercise) => exercise.sets)).toEqual([2, 1, 1]);
    expect(snapshot.adaptation.reasons).toContain("time_limit");
    expect(snapshot.adaptation.timeBudgetMinutes).toBe(30);
  });

  it("uses only curated, catalog-present substitutions that match available equipment", () => {
    const snapshot = buildWorkoutExecutionSnapshot({
      day,
      readinessModifier: 1,
      lifeContexts: [context({ kind: "equipment_limited", equipment: ["dumbbell"] })],
      exerciseCatalog: catalog,
    });

    expect(snapshot.workout.exercises.map((exercise) => exercise.slug)).toEqual([
      "goblet-squat",
      "dumbbell-press",
      "one-arm-db-row",
    ]);
    expect(snapshot.adaptation.substitutions).toEqual([
      { fromSlug: "squat", toSlug: "goblet-squat" },
      { fromSlug: "bench-press", toSlug: "dumbbell-press" },
      { fromSlug: "barbell-row", toSlug: "one-arm-db-row" },
    ]);
    expect(snapshot.adaptation.reasons).toContain("equipment_limit");
  });

  it("reduces volume for an explicitly reported high-stress day without an AI call", () => {
    const snapshot = buildWorkoutExecutionSnapshot({
      day,
      readinessModifier: 1,
      lifeContexts: [context({ kind: "high_stress" })],
      exerciseCatalog: [],
    });

    expect(snapshot.adaptation.readinessModifier).toBe(0.8);
    expect(snapshot.workout.exercises.map((exercise) => exercise.sets)).toEqual([2, 2, 2]);
    expect(snapshot.adaptation.reasons).toContain("high_stress");
  });

  it("uses bodyweight-only curated substitutions while traveling until equipment is reported", () => {
    const snapshot = buildWorkoutExecutionSnapshot({
      day,
      readinessModifier: 1,
      lifeContexts: [context({ kind: "travel" })],
      exerciseCatalog: catalog,
    });

    expect(snapshot.workout.exercises.map((exercise) => exercise.slug)).toEqual([
      "bodyweight-squat",
      "push-up",
      "inverted-row",
    ]);
    expect(snapshot.adaptation.reasons).toContain("travel");
    expect(snapshot.adaptation.sourceContextIds).toEqual(["00000000-0000-4000-8000-000000000100"]);
  });

  it("keeps an explicit equipment report more precise than the travel fallback", () => {
    const snapshot = buildWorkoutExecutionSnapshot({
      day,
      readinessModifier: 1,
      lifeContexts: [
        context({ kind: "travel" }),
        context({ kind: "equipment_limited", equipment: ["dumbbell"] }),
      ],
      exerciseCatalog: catalog,
    });

    expect(snapshot.workout.exercises.map((exercise) => exercise.slug)).toEqual([
      "goblet-squat",
      "dumbbell-press",
      "one-arm-db-row",
    ]);
    expect(snapshot.adaptation.reasons).toEqual(["equipment_limit", "travel"]);
  });

  it("treats an explicit temporary limitation as a workout-entry safety constraint", () => {
    expect(hasActiveWorkoutSafetyConstraint([context({ kind: "temporary_limitation" })])).toBe(
      true,
    );
    expect(hasActiveWorkoutSafetyConstraint([context({ kind: "high_stress" })])).toBe(false);
  });

  it("refuses to invent a same-muscle replacement when no curated route is available", () => {
    expect(() =>
      buildWorkoutExecutionSnapshot({
        day: { ...day, exercises: [{ ...day.exercises[0]!, slug: "unknown-machine-lift" }] },
        readinessModifier: 1,
        lifeContexts: [context({ kind: "facility_closed" })],
        exerciseCatalog: catalog,
      }),
    ).toThrow("No safe workout exercises");
  });
});
