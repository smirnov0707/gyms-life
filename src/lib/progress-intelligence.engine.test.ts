import { describe, expect, it } from "vitest";
import { analyzeExerciseProgress } from "./progress-intelligence.engine";

const point = (e1rm: number, rpe = 7, date = "2026-01-01") => ({
  date,
  weightKg: e1rm,
  reps: 1,
  rpe,
  estimated1RMKg: e1rm,
});

describe("progress intelligence", () => {
  it("flags insufficient data", () =>
    expect(analyzeExerciseProgress([point(100)]).signal).toBe("INSUFFICIENT_DATA"));
  it("detects meaningful progress", () =>
    expect(analyzeExerciseProgress([point(100), point(102), point(104)]).signal).toBe(
      "PROGRESSING",
    ));
  it("detects stagnation", () =>
    expect(analyzeExerciseProgress([point(100), point(100.5), point(101)]).signal).toBe(
      "STAGNATING",
    ));
  it("detects fatigue risk from declining performance and high RPE", () =>
    expect(analyzeExerciseProgress([point(110, 9), point(108, 9.5), point(106, 9.5)]).signal).toBe(
      "FATIGUE_RISK",
    ));
  it("returns evidence for decisions", () =>
    expect(
      analyzeExerciseProgress([point(100), point(102), point(104)]).evidence.length,
    ).toBeGreaterThan(0));
});
