import { describe, expect, it } from "vitest";
import {
  formatExerciseCatalogForAi,
  parseDemonstratedExerciseCatalog,
} from "./exercise-catalog.schema";

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
});
