import { describe, expect, it } from "vitest";
import {
  REPS_STEP,
  WEIGHT_STEP_KG,
  plannedRepsPrefill,
  stepValue,
  suggestedWeightPrefill,
} from "./workout-set-prefill";

describe("plannedRepsPrefill", () => {
  it("pre-fills an unambiguous planned rep count", () => {
    expect(plannedRepsPrefill(8)).toBe("8");
    expect(plannedRepsPrefill("12")).toBe("12");
    expect(plannedRepsPrefill(" 5 ")).toBe("5");
  });

  it("refuses to pick an end of a range", () => {
    // The plan asked for somewhere in 8-12. Pre-filling 8 would put a number
    // in the box that the plan never asked for, and it could be logged unread.
    for (const range of ["8-12", "8–12", "8 - 12", "10-15"]) {
      expect(plannedRepsPrefill(range), range).toBe("");
    }
  });

  it("refuses anything that is not a plain count", () => {
    for (const value of ["AMRAP", "max", "", "  ", "8+", "~10", "8.5", "-5"]) {
      expect(plannedRepsPrefill(value), value).toBe("");
    }
  });

  it("rejects counts outside what the input accepts", () => {
    expect(plannedRepsPrefill("0")).toBe("");
    expect(plannedRepsPrefill("101")).toBe("");
    expect(plannedRepsPrefill("100")).toBe("100");
  });
});

describe("suggestedWeightPrefill", () => {
  it("uses a coach suggestion when there is one", () => {
    expect(suggestedWeightPrefill(77.5)).toBe("77.5");
    expect(suggestedWeightPrefill(0)).toBe("0");
  });

  it("stays empty rather than guessing a load", () => {
    expect(suggestedWeightPrefill(null)).toBe("");
    expect(suggestedWeightPrefill(undefined)).toBe("");
    expect(suggestedWeightPrefill(Number.NaN)).toBe("");
    expect(suggestedWeightPrefill(-10)).toBe("");
  });
});

describe("stepValue", () => {
  const weight = { min: 0, max: 1000, fallback: 0 };
  const reps = { min: 1, max: 100, fallback: 8 };

  it("steps an existing value", () => {
    expect(stepValue("60", WEIGHT_STEP_KG, weight)).toBe("62.5");
    expect(stepValue("60", -WEIGHT_STEP_KG, weight)).toBe("57.5");
    expect(stepValue("8", REPS_STEP, reps)).toBe("9");
  });

  it("starts from the fallback when the field is empty", () => {
    expect(stepValue("", REPS_STEP, reps)).toBe("9");
    expect(stepValue("   ", WEIGHT_STEP_KG, weight)).toBe("2.5");
  });

  it("clamps to the range the input accepts", () => {
    expect(stepValue("0", -WEIGHT_STEP_KG, weight)).toBe("0");
    expect(stepValue("1", -REPS_STEP, reps)).toBe("1");
    expect(stepValue("100", REPS_STEP, reps)).toBe("100");
    expect(stepValue("1000", WEIGHT_STEP_KG, weight)).toBe("1000");
  });

  it("does not accumulate floating point noise", () => {
    let value = "0";
    for (let i = 0; i < 8; i += 1) value = stepValue(value, WEIGHT_STEP_KG, weight);
    expect(value).toBe("20");
  });
});
