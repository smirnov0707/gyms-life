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

    expect(selected.exercises).toEqual(barbellRows);
    expect(selected.equipmentConstrained).toBe(true);
  });

  it("says when it gave up on the equipment constraint", () => {
    // The fallback is defensible as a pool decision — three exercises cannot
    // fill a workout day. It is not defensible as a silent one: a caller that
    // validates the model's answer against a pool it does not know was widened
    // is checking a constraint that had already been abandoned, and every such
    // check passes.
    const bandRows = [
      { ...catalogRow, slug: "band-row", equipment: "band", location: "home" },
      { ...catalogRow, slug: "band-curl", equipment: "band", location: "home" },
    ];
    const selected = selectPlanExerciseCatalog([...bandRows, catalogRow], {
      equipment: ["band"],
      location: "home",
    });

    expect(selected.equipmentConstrained).toBe(false);
    // And the pool really is everything, so validating against it is honest
    // rather than a check that rejects the very list the model was handed.
    expect(selected.exercises).toHaveLength(3);
  });

  it("treats no recorded equipment as bodyweight, not as no constraint", () => {
    // "I own nothing" is an answer. The suggestion path used to read an empty
    // list as "no filter" and offer the whole catalog, so the same athlete got
    // a bodyweight plan and barbell suggestions.
    const bodyweightRows = Array.from({ length: 4 }, (_, index) => ({
      ...catalogRow,
      slug: `push-up-${index}`,
      equipment: "bodyweight",
      location: "home",
    }));
    const selected = selectPlanExerciseCatalog([...bodyweightRows, catalogRow], {
      equipment: [],
      location: "home",
    });

    expect(selected.equipmentConstrained).toBe(true);
    expect(selected.exercises).toEqual(bodyweightRows);
  });

  it("accepts the plural spelling the onboarding form produces", () => {
    const bandRows = Array.from({ length: 4 }, (_, index) => ({
      ...catalogRow,
      slug: `band-${index}`,
      equipment: "band",
      location: "home",
    }));
    const selected = selectPlanExerciseCatalog([...bandRows, catalogRow], {
      equipment: ["bands"],
      location: "home",
    });

    expect(selected.equipmentConstrained).toBe(true);
    expect(selected.exercises).toEqual(bandRows);
  });
});
