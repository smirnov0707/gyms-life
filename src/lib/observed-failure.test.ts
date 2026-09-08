import { describe, expect, it } from "vitest";
import { ObservedFailure } from "./observability.server";
import { validateGeneratedTrainingPlan } from "./training-plan-generation.validation";
import type { TrainingPlanData } from "./training-plan.schema";

/**
 * Production holds six `TRAINING_PLAN_GENERATION_FAILED` rows against two
 * successes, each with an empty metadata object. Six identical rows are six
 * rows nobody can act on: the model may have returned the wrong number of
 * days, too few exercises, a duplicate, an exercise outside the catalogue, or
 * JSON the schema would not take, and the ledger said none of it.
 */

const day = (dayNumber: number, slugs: string[]) => ({
  day: dayNumber,
  title: `Day ${dayNumber}`,
  exercises: slugs.map((slug) => ({
    slug,
    name: slug,
    sets: 3,
    reps: "8-10",
    rest_seconds: 90,
  })),
});

const plan = (days: ReturnType<typeof day>[]): TrainingPlanData =>
  ({
    title: "Plan",
    summary: "Summary",
    weeks: 8,
    progression: "Progressive overload",
    nutrition: "Eat well",
    days,
  }) as unknown as TrainingPlanData;

const four = ["a", "b", "c", "d"];
const catalog = ["a", "b", "c", "d", "e", "f"];

describe("a failure that knows which rule rejected it", () => {
  it("keeps a reason the metadata schema will accept", () => {
    expect(new ObservedFailure("schema_rejected", "message").reason).toBe("schema_rejected");
  });

  it("falls back rather than writing a reason that would fail the write", () => {
    // A value the metadata schema rejects would fail the whole observability
    // write, turning a failure that tried to explain itself into one that
    // vanished — the same trap as the ledger's error code.
    for (const bad of ["Has Spaces", "UPPER", "ab", "1abc", "with-dash", "a".repeat(65)]) {
      expect(new ObservedFailure(bad, "message").reason).toBe("unspecified");
    }
  });

  it("keeps the human message, because the athlete reads it", () => {
    const failure = new ObservedFailure("missing_days", "Please try again.");
    expect(failure.message).toBe("Please try again.");
    expect(failure).toBeInstanceOf(Error);
  });
});

describe("what a rejected training plan now says about itself", () => {
  it("names the wrong number of days", () => {
    expect(() => validateGeneratedTrainingPlan(plan([day(1, four)]), 2, catalog)).toThrow(
      ObservedFailure,
    );
    try {
      validateGeneratedTrainingPlan(plan([day(1, four)]), 2, catalog);
    } catch (error) {
      expect((error as ObservedFailure).reason).toBe("missing_days");
    }
  });

  it("names an exercise count outside the allowed range", () => {
    try {
      validateGeneratedTrainingPlan(plan([day(1, ["a", "b"])]), 1, catalog);
    } catch (error) {
      expect((error as ObservedFailure).reason).toBe("exercise_count");
    }
  });

  it("names a repeated exercise", () => {
    try {
      validateGeneratedTrainingPlan(plan([day(1, ["a", "b", "c", "a"])]), 1, catalog);
    } catch (error) {
      expect((error as ObservedFailure).reason).toBe("duplicate_exercise");
    }
  });

  it("names an exercise the athlete cannot do", () => {
    // The pool the model was handed is the pool its answer is checked against,
    // so this is also how an equipment violation shows up in the ledger.
    try {
      validateGeneratedTrainingPlan(plan([day(1, ["a", "b", "c", "z"])]), 1, catalog);
    } catch (error) {
      expect((error as ObservedFailure).reason).toBe("outside_catalog");
    }
  });

  it("still accepts a plan that breaks no rule", () => {
    expect(validateGeneratedTrainingPlan(plan([day(1, four)]), 1, catalog)).toBeTruthy();
  });
});
