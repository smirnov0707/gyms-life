import { describe, expect, it } from "vitest";
import {
  buildSessionMuscleBreakdown,
  stimulusFor,
  type SessionSetSource,
} from "./session-muscle-breakdown";

const CATALOGUE = [
  { slug: "bench-press", muscle_group: "chest" },
  { slug: "incline-db-press", muscle_group: "chest" },
  { slug: "pull-up", muscle_group: "back" },
  { slug: "run", muscle_group: "cardio" },
];

function set(
  slug: string,
  reps: number | null,
  weight: number | null,
  done = true,
): SessionSetSource {
  return { exercise_slug: slug, reps, weight_kg: weight, done };
}

describe("buildSessionMuscleBreakdown", () => {
  it("attributes volume to muscle groups, heaviest first", () => {
    const result = buildSessionMuscleBreakdown(
      [set("bench-press", 10, 60), set("incline-db-press", 10, 20), set("pull-up", 10, 10)],
      CATALOGUE,
    );

    expect(result.map((r) => r.muscleGroup)).toEqual(["chest", "back"]);
    expect(result[0]?.volumeKg).toBe(800);
    expect(result[0]?.sets).toBe(2);
    expect(result[1]?.volumeKg).toBe(100);
  });

  it("computes each group's share of the session", () => {
    const result = buildSessionMuscleBreakdown(
      [set("bench-press", 10, 75), set("pull-up", 10, 25)],
      CATALOGUE,
    );

    expect(result[0]?.shareOfSession).toBe(0.75);
    expect(result[1]?.shareOfSession).toBe(0.25);
  });

  it("never counts a set the person did not complete", () => {
    const result = buildSessionMuscleBreakdown(
      [set("bench-press", 10, 60), set("bench-press", 10, 60, false)],
      CATALOGUE,
    );

    expect(result[0]?.sets).toBe(1);
    expect(result[0]?.volumeKg).toBe(600);
  });

  it("skips a set whose exercise is not in the catalogue rather than guessing", () => {
    const result = buildSessionMuscleBreakdown(
      [set("bench-press", 10, 60), set("mystery-lift", 10, 999)],
      CATALOGUE,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.muscleGroup).toBe("chest");
  });

  it("withholds a share rather than dividing by zero when nothing was loaded", () => {
    // A bodyweight or cardio session has real sets but no volume to share out.
    const result = buildSessionMuscleBreakdown(
      [set("run", 1, null), set("pull-up", 8, 0)],
      CATALOGUE,
    );

    expect(result).toHaveLength(2);
    for (const entry of result) {
      expect(entry.volumeKg).toBe(0);
      expect(entry.shareOfSession).toBeNull();
      expect(entry.sets).toBeGreaterThan(0);
    }
  });

  it("treats a missing rep or weight as zero volume, not as a missing set", () => {
    const result = buildSessionMuscleBreakdown([set("bench-press", null, 60)], CATALOGUE);
    expect(result[0]?.sets).toBe(1);
    expect(result[0]?.volumeKg).toBe(0);
  });

  it("returns nothing for a session with no sets", () => {
    expect(buildSessionMuscleBreakdown([], CATALOGUE)).toEqual([]);
  });
});

describe("stimulusFor", () => {
  const base = { muscleGroup: "chest", volumeKg: 100, sets: 1 };

  it("ranks by share of the session", () => {
    expect(stimulusFor({ ...base, shareOfSession: 0.6 })).toBe("primary");
    expect(stimulusFor({ ...base, shareOfSession: 0.3 })).toBe("primary");
    expect(stimulusFor({ ...base, shareOfSession: 0.2 })).toBe("secondary");
    expect(stimulusFor({ ...base, shareOfSession: 0.1 })).toBe("secondary");
    expect(stimulusFor({ ...base, shareOfSession: 0.05 })).toBe("light");
  });

  it("does not claim a rank it cannot compute", () => {
    expect(stimulusFor({ ...base, shareOfSession: null })).toBe("light");
  });
});
