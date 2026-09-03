import { describe, expect, it } from "vitest";
import {
  canonicalizeGeneratedPlanExercises,
  formatExerciseCatalogForAi,
  parseDemonstratedExerciseCatalog,
  selectPlanExerciseCatalog,
} from "./exercise-catalog.schema";
import { TrainingPlanDataSchema } from "./training-plan.schema";

const catalogRow = {
  slug: "squat",
  name_en: "Barbell Squat",
  name_lt: "Pritūpimai su štanga",
  muscle_group: "legs",
  equipment: "barbell",
  location: "gym",
  difficulty: "intermediate",
};

describe("demonstrated exercise catalog", () => {
  it("keeps only canonical exercise records with usable technique media", () => {
    expect(
      parseDemonstratedExerciseCatalog([
        catalogRow,
        { ...catalogRow, slug: "unknown-exercise" },
        { ...catalogRow, slug: "SQUAT" },
        catalogRow,
      ]),
    ).toEqual([catalogRow]);
  });

  it("renders the validated catalog as a stable AI contract", () => {
    expect(formatExerciseCatalogForAi([catalogRow])).toBe(
      "squat | Barbell Squat / Pritūpimai su štanga | legs | barbell | gym | intermediate",
    );
  });

  it("maps only exact catalog aliases back to a canonical plan exercise", () => {
    const plan = TrainingPlanDataSchema.parse({
      title: "Plan",
      summary: "Summary",
      weeks: 8,
      progression: "Progress",
      nutrition: "Nutrition",
      days: [
        {
          day: 1,
          title: "Day",
          focus: "Legs",
          warmup: "Warmup",
          cooldown: "Cooldown",
          estimated_minutes: 45,
          exercises: [
            {
              slug: "Barbell Squat",
              name: "Barbell Squat",
              sets: 3,
              reps: "8",
              rest_seconds: 90,
            },
          ],
        },
      ],
    });

    const canonical = canonicalizeGeneratedPlanExercises(plan, [catalogRow], "lt");

    expect(canonical.days[0]?.exercises[0]).toMatchObject({
      slug: "squat",
      name: "Pritūpimai su štanga",
    });
  });

  it("limits plan generation to compatible catalog equipment while retaining bodyweight", () => {
    const barbellRows = [
      catalogRow,
      { ...catalogRow, slug: "barbell-row" },
      { ...catalogRow, slug: "barbell-lunge" },
      { ...catalogRow, slug: "barbell-curl" },
    ];
    const cableRows = [
      { ...catalogRow, slug: "cable-row", equipment: "cable" },
      { ...catalogRow, slug: "cable-press", equipment: "cable" },
      { ...catalogRow, slug: "cable-curl", equipment: "cable" },
      { ...catalogRow, slug: "cable-fly", equipment: "cable" },
    ];
    const selected = selectPlanExerciseCatalog([...barbellRows, ...cableRows], {
      equipment: ["barbell"],
      location: "gym",
    });

    expect(selected).toEqual(barbellRows);
  });
});
