import { describe, expect, it } from "vitest";
import { hasMealCalculationInputs } from "./meal-profile.guard";
const body = { age: 35, gender: "female", heightCm: 170, weightKg: 68 };
describe("automatic meal calculation prerequisites", () => {
  it("accepts explicitly provided calculation inputs", () =>
    expect(hasMealCalculationInputs(body)).toBe(true));
  it.each([
    { age: null },
    { gender: null },
    { gender: "other" },
    { heightCm: null },
    { weightKg: null },
    { weightKg: Number.NaN },
    { heightCm: Infinity },
    { weightKg: -1 },
  ])("does not invent missing or invalid body data: %j", (missing) => {
    expect(hasMealCalculationInputs({ ...body, ...missing })).toBe(false);
  });
});
