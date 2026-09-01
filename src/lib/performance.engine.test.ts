import { describe, expect, it } from "vitest";
import { calculateAverage, calculateEstimated1RM, calculateVolume } from "./performance.engine";

describe("performance engine", () => {
  it("calculates set volume", () => expect(calculateVolume(10, 50)).toBe(500));
  it("does not calculate volume from missing weight", () =>
    expect(calculateVolume(10, null)).toBe(0));
  it("calculates estimated 1RM separately from actual weight", () =>
    expect(calculateEstimated1RM(100, 10)).toBe(133.3));
  it("rejects invalid 1RM inputs", () => expect(calculateEstimated1RM(0, 10)).toBeNull());
  it("calculates rounded averages", () => expect(calculateAverage([7, 8, 9])).toBe(8));
  it("returns null for an empty average", () => expect(calculateAverage([])).toBeNull());
});
