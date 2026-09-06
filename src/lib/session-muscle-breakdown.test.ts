import { describe, expect, it } from "vitest";
import {
  buildSessionMuscleBreakdown,
  stimulusFor,
  UNASSIGNED_SESSION_REGION,
  type SessionSetSource,
} from "./session-muscle-breakdown";
const catalogue = [
  { slug: "bench", muscle_group: "chest" },
  { slug: "incline", muscle_group: "chest" },
  { slug: "pullup", muscle_group: "back" },
  { slug: "run", muscle_group: "cardio" },
];
function set(
  slug: string,
  reps: number | null,
  weight: number | null,
  done: boolean | null = true,
): SessionSetSource {
  return { exercise_slug: slug, reps, weight_kg: weight, done };
}
describe("session recorded evidence", () => {
  it("attributes supported volume to groups, heaviest first", () => {
    const result = buildSessionMuscleBreakdown(
      [set("bench", 10, 60), set("incline", 10, 20), set("pullup", 10, 10)],
      catalogue,
    );
    expect(result.map((r) => [r.muscleGroup, r.volumeKg, r.sets])).toEqual([
      ["chest", 800, 2],
      ["back", 100, 1],
    ]);
  });
  it("computes shares only with a complete denominator", () => {
    const result = buildSessionMuscleBreakdown(
      [set("bench", 10, 75), set("pullup", 10, 25)],
      catalogue,
    );
    expect(result.map((r) => r.shareOfSession)).toEqual([0.75, 0.25]);
  });
  it.each([false, null])("excludes done=%s rather than assuming completion", (done) => {
    const result = buildSessionMuscleBreakdown(
      [set("bench", 10, 60), set("bench", 10, 60, done)],
      catalogue,
    );
    expect(result[0]).toMatchObject({ sets: 1, volumeKg: 600 });
  });
  it.each([
    [null, 60],
    [10, null],
    [0, 60],
    [-1, 60],
    [1.5, 60],
    [10, -1],
    [10, Number.MAX_SAFE_INTEGER],
  ])("retains sets but withholds an incomplete group (%s reps, %s kg)", (reps, weight) => {
    const source = [set("bench", 10, 60), set("incline", reps, weight), set("pullup", 10, 25)];
    const before = structuredClone(source);
    const result = buildSessionMuscleBreakdown(source, catalogue);
    expect(result.find((r) => r.muscleGroup === "chest")).toMatchObject({
      sets: 2,
      volumeKg: null,
      shareOfSession: null,
    });
    expect(result.find((r) => r.muscleGroup === "back")).toMatchObject({
      sets: 1,
      volumeKg: 250,
      shareOfSession: null,
    });
    expect(source).toEqual(before);
  });
  it("distinguishes an explicit external-weight zero from missing weight", () => {
    const result = buildSessionMuscleBreakdown(
      [set("run", 1, null), set("pullup", 8, 0)],
      catalogue,
    );
    expect(result.find((r) => r.muscleGroup === "back")).toMatchObject({
      sets: 1,
      volumeKg: 0,
      shareOfSession: null,
    });
    expect(result.find((r) => r.muscleGroup === "cardio")).toMatchObject({
      sets: 1,
      volumeKg: null,
      shareOfSession: null,
    });
  });
  it("does not discard unmapped completed sets", () => {
    const result = buildSessionMuscleBreakdown(
      [set("bench", 10, 60), set("mystery", 10, 20)],
      catalogue,
    );
    expect(result.find((r) => r.muscleGroup === UNASSIGNED_SESSION_REGION)).toMatchObject({
      sets: 1,
      volumeKg: 200,
      mappingStatus: "unassigned",
    });
    expect(result.reduce((sum, r) => sum + r.sets, 0)).toBe(2);
  });
  it("does not trust stale catalogue values when the source failed", () => {
    expect(buildSessionMuscleBreakdown([set("bench", 10, 60)], catalogue, false)).toEqual([
      {
        muscleGroup: UNASSIGNED_SESSION_REGION,
        sets: 1,
        volumeKg: 600,
        shareOfSession: 1,
        mappingStatus: "unavailable",
      },
    ]);
  });
  it("distinguishes a successful empty catalogue from its failure", () => {
    const input = [set("bench", 10, 60)];
    expect(buildSessionMuscleBreakdown(input, [])[0]?.mappingStatus).toBe("unassigned");
    expect(buildSessionMuscleBreakdown(input, [], false)[0]?.mappingStatus).toBe("unavailable");
  });
  it("does not guess through conflicting catalogue assignments", () => {
    const conflicting = [...catalogue, { slug: "bench", muscle_group: "arms" }];
    expect(buildSessionMuscleBreakdown([set("bench", 10, 60)], conflicting)[0]?.muscleGroup).toBe(
      UNASSIGNED_SESSION_REGION,
    );
  });
  it("withholds an unsafe group aggregate", () => {
    const large = set("bench", 1, Number.MAX_SAFE_INTEGER);
    expect(buildSessionMuscleBreakdown([large, large], catalogue)[0]?.volumeKg).toBeNull();
  });
  it("retains safe groups but withholds an unsafe session percentage", () => {
    const result = buildSessionMuscleBreakdown(
      [set("bench", 1, Number.MAX_SAFE_INTEGER), set("pullup", 1, Number.MAX_SAFE_INTEGER)],
      catalogue,
    );
    expect(
      result.every((r) => r.volumeKg === Number.MAX_SAFE_INTEGER && r.shareOfSession === null),
    ).toBe(true);
  });
  it("preserves unlisted catalogue groups without assigning anatomy", () => {
    expect(
      buildSessionMuscleBreakdown(
        [set("grip", 5, 10)],
        [{ slug: "grip", muscle_group: "forearms" }],
      )[0]?.muscleGroup,
    ).toBe("forearms");
  });
  it("does not divide by zero", () => {
    expect(
      buildSessionMuscleBreakdown([set("pullup", 8, 0)], catalogue)[0]?.shareOfSession,
    ).toBeNull();
  });
  it("returns an empty list for an empty session", () => {
    expect(buildSessionMuscleBreakdown([], catalogue)).toEqual([]);
  });
});
describe("legacy relative-volume labels", () => {
  const base = { muscleGroup: "chest", volumeKg: 100, sets: 1 };
  it("keeps the existing boundaries for compatibility", () => {
    expect(stimulusFor({ ...base, shareOfSession: 0.3 })).toBe("primary");
    expect(stimulusFor({ ...base, shareOfSession: 0.1 })).toBe("secondary");
    expect(stimulusFor({ ...base, shareOfSession: 0.05 })).toBe("light");
    expect(stimulusFor({ ...base, shareOfSession: null })).toBe("light");
  });
});
