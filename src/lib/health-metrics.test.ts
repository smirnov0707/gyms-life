import { describe, expect, it } from "vitest";
import {
  healthLoadModifier,
  READINESS_MINIMUM_COVERAGE,
  recoveryScore,
  type Baseline,
  type HealthInput,
} from "./health-metrics";

/**
 * This engine had no tests, which is how it came to report a readiness score
 * built from a step count, a zero for an athlete who had never worn a watch,
 * and a confident middle value for a first HRV reading with nothing to
 * compare it against — all of it feeding the modifier that decides how much
 * work the athlete is told to do.
 */

const nothing: HealthInput = {
  restingHr: null,
  hrvMs: null,
  sleepHours: null,
  sleepQuality: null,
  steps: null,
  activeKcal: null,
};
const noBaseline: Baseline = { restingHr: null, hrvMs: null };

describe("recoveryScore", () => {
  it("says nothing when nothing was measured", () => {
    // Not zero. Zero is the worst possible reading, and nobody took it.
    expect(recoveryScore(nothing, noBaseline)).toBeNull();
  });

  it("refuses to build a readiness score out of a step count", () => {
    expect(recoveryScore({ ...nothing, steps: 8342 }, noBaseline)).toBeNull();
  });

  it("refuses sleep duration on its own", () => {
    // 30 of 100 points. A whole-body readiness figure from one number.
    expect(recoveryScore({ ...nothing, sleepHours: 8 }, noBaseline)).toBeNull();
  });

  it("does not compare a reading against itself", () => {
    // With no baseline there is nothing to compare an HRV or a resting heart
    // rate to. This used to score them at 60% and 83% of their components
    // respectively, out of a single reading.
    expect(recoveryScore({ ...nothing, hrvMs: 68, restingHr: 52 }, noBaseline)).toBeNull();
    const withBaseline = recoveryScore(
      { ...nothing, hrvMs: 68, restingHr: 52 },
      { hrvMs: 68, restingHr: 52 },
    );
    expect(withBaseline).not.toBeNull();
    expect(withBaseline?.measured).toEqual(["hrv", "resting_hr"]);
    expect(withBaseline?.coverage).toBe(50);
  });

  it("takes both sleep components together, without needing a step count", () => {
    // The pair is 45 of the model's 100 and is a real readiness signal. An
    // earlier threshold of 50 turned it away while accepting the same pair
    // plus a step count — letting the least informative component be the one
    // that unlocked the score.
    const readiness = recoveryScore({ ...nothing, sleepHours: 8, sleepQuality: 5 }, noBaseline);
    expect(readiness).not.toBeNull();
    expect(readiness?.coverage).toBe(45);
    expect(readiness?.coverage).toBeGreaterThanOrEqual(READINESS_MINIMUM_COVERAGE);
    // Eight hours is the top of the sleep band and quality is 5 of 5, so this
    // is a high score, honestly earned.
    expect(readiness?.score).toBe(100);
  });

  it("still turns away a single signal, whichever one it is", () => {
    expect(recoveryScore({ ...nothing, sleepQuality: 5 }, noBaseline)).toBeNull();
    expect(recoveryScore({ ...nothing, sleepHours: 8, steps: 100 }, noBaseline)).toBeNull();
  });

  it("reports what the score rests on, heaviest component first", () => {
    const readiness = recoveryScore(
      { ...nothing, sleepHours: 7, sleepQuality: 3, hrvMs: 68, restingHr: 52 },
      { hrvMs: 70, restingHr: 50 },
    );
    expect(readiness?.measured).toEqual(["sleep_duration", "hrv", "resting_hr", "sleep_quality"]);
    expect(readiness?.coverage).toBe(95);
  });

  it("reads a worse night as a lower score", () => {
    const good = recoveryScore({ ...nothing, sleepHours: 8, sleepQuality: 5 }, noBaseline);
    const bad = recoveryScore({ ...nothing, sleepHours: 4.5, sleepQuality: 1 }, noBaseline);
    expect(good).not.toBeNull();
    expect(bad).not.toBeNull();
    expect(bad!.score).toBeLessThan(good!.score);
  });

  it("reads a suppressed HRV against the athlete's own baseline", () => {
    const suppressed = recoveryScore(
      { ...nothing, hrvMs: 40, restingHr: 60 },
      {
        hrvMs: 70,
        restingHr: 52,
      },
    );
    const rested = recoveryScore(
      { ...nothing, hrvMs: 78, restingHr: 50 },
      {
        hrvMs: 70,
        restingHr: 52,
      },
    );
    expect(suppressed!.score).toBeLessThan(rested!.score);
  });
});

describe("healthLoadModifier", () => {
  it("leaves the plan alone when readiness was withheld", () => {
    // The old behaviour scored no-data as zero and then cut the day by a
    // third. An absence of measurement must not quietly change training.
    expect(healthLoadModifier(null)).toBe(1);
  });

  it("still adjusts on a score that was actually measured", () => {
    expect(healthLoadModifier(90)).toBe(1.05);
    expect(healthLoadModifier(75)).toBe(1);
    expect(healthLoadModifier(60)).toBe(0.9);
    expect(healthLoadModifier(45)).toBe(0.8);
    expect(healthLoadModifier(20)).toBe(0.65);
  });

  it("refuses a score that is not a number", () => {
    expect(healthLoadModifier(Number.NaN)).toBe(1);
  });
});
