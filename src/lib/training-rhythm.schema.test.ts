import { describe, expect, it } from "vitest";
import { TrainingRhythmInputSchema, trainingRhythmFromDatabaseRow } from "./training-rhythm.schema";

describe("training rhythm schema", () => {
  it("sorts a valid user-selected weekly preference into canonical order", () => {
    const result = TrainingRhythmInputSchema.parse({ preferredWeekdays: [5, 1, 3] });

    expect(result.preferredWeekdays).toEqual([1, 3, 5]);
  });

  it("rejects duplicate or invalid weekdays instead of silently changing user intent", () => {
    expect(TrainingRhythmInputSchema.safeParse({ preferredWeekdays: [1, 1, 3] }).success).toBe(
      false,
    );
    expect(TrainingRhythmInputSchema.safeParse({ preferredWeekdays: [7] }).success).toBe(false);
  });

  it("maps only a validated narrow database row into the domain model", () => {
    expect(
      trainingRhythmFromDatabaseRow({
        preferred_weekdays: [5, 1],
        updated_at: "2026-09-03T17:00:00.000Z",
      }),
    ).toEqual({
      preferredWeekdays: [1, 5],
      updatedAt: "2026-09-03T17:00:00.000Z",
    });
  });
});
