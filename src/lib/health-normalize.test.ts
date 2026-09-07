import { describe, expect, it } from "vitest";
import {
  SAMPLE_BACKFILL_DAYS,
  SAMPLE_FORWARD_DAYS,
  normalizeDate,
  normalizeHealthPayload,
  sampleDateWithinWindow,
  toNumber,
} from "./health-normalize";

/**
 * This module is the only place untrusted input reaches the one public write
 * endpoint the app has, and until now nothing tested it.
 */

describe("toNumber", () => {
  it("reads the shapes phone automations actually send", () => {
    expect(toNumber(9800)).toBe(9800);
    expect(toNumber("9 800")).toBe(9800);
    expect(toNumber("9,800")).toBe(9800);
    expect(toNumber("9.800")).toBe(9800);
    expect(toNumber("8342 steps")).toBe(8342);
    // A comma decimal is a comma decimal everywhere but the anglosphere.
    expect(toNumber("7,4")).toBe(7.4);
    expect(toNumber("1.234,5")).toBe(1234.5);
    expect(toNumber("1,234.5")).toBe(1234.5);
  });

  it("refuses what is not a number instead of guessing at one", () => {
    for (const value of [null, undefined, "", "   ", "n/a", {}, [], true]) {
      expect(toNumber(value)).toBeNull();
    }
  });
});

describe("normalizeDate", () => {
  it("reads the formats a shortcut can produce", () => {
    expect(normalizeDate("2026-09-07")).toBe("2026-09-07");
    expect(normalizeDate("2026-09-07T22:15:00Z")).toBe("2026-09-07");
    expect(normalizeDate("7.9.2026")).toBe("2026-09-07");
    expect(normalizeDate("07/09/2026")).toBe("2026-09-07");
  });

  it("refuses a day that does not exist", () => {
    // These used to be handed back from the regex capture groups untouched and
    // travelled all the way to Postgres, where the write failed and the
    // athlete was told the service was temporarily unavailable.
    expect(normalizeDate("2026-13-45")).toBeNull();
    expect(normalizeDate("2025-02-30")).toBeNull();
    expect(normalizeDate("2026-00-10")).toBeNull();
    expect(normalizeDate("31.02.2026")).toBeNull();
    expect(normalizeDate("not a date")).toBeNull();
    expect(normalizeDate(20260907)).toBeNull();
  });
});

describe("sampleDateWithinWindow", () => {
  const today = "2026-09-07";

  it("accepts today, yesterday and a phone that was offline on holiday", () => {
    expect(sampleDateWithinWindow(today, today)).toBe(true);
    expect(sampleDateWithinWindow("2026-09-06", today)).toBe(true);
    expect(sampleDateWithinWindow("2026-08-20", today)).toBe(true);
  });

  it("allows one day forward, for a profile whose time zone is wrong", () => {
    expect(SAMPLE_FORWARD_DAYS).toBe(1);
    expect(sampleDateWithinWindow("2026-09-08", today)).toBe(true);
    expect(sampleDateWithinWindow("2026-09-09", today)).toBe(false);
  });

  it("refuses a date far enough away to be a broken automation", () => {
    expect(SAMPLE_BACKFILL_DAYS).toBe(90);
    // Exactly at the edge is still in; one day past it is not.
    expect(sampleDateWithinWindow("2026-06-09", today)).toBe(true);
    expect(sampleDateWithinWindow("2026-06-08", today)).toBe(false);
    expect(sampleDateWithinWindow("2019-01-01", today)).toBe(false);
    expect(sampleDateWithinWindow("2099-01-01", today)).toBe(false);
  });

  it("refuses an impossible day rather than treating it as distant", () => {
    expect(sampleDateWithinWindow("2026-13-45", today)).toBe(false);
    expect(sampleDateWithinWindow(today, "nonsense")).toBe(false);
  });
});

describe("normalizeHealthPayload", () => {
  it("takes the same reading under any of the names a source uses", () => {
    expect(normalizeHealthPayload({ resting_heart_rate: "52" }).restingHr).toBe(52);
    expect(normalizeHealthPayload({ rhr: 52 }).restingHr).toBe(52);
    expect(normalizeHealthPayload({ "Resting HR": 52 }).restingHr).toBe(52);
  });

  it("reads HRV in seconds as the milliseconds it means", () => {
    // Shortcuts hand SDNN over as 0.078 rather than 78 often enough that the
    // value has to be recognised rather than rejected as out of range.
    expect(normalizeHealthPayload({ hrv: 0.078 }).hrvMs).toBe(78);
    expect(normalizeHealthPayload({ hrv_ms: 68 }).hrvMs).toBe(68);
  });

  it("drops a reading no human body produces", () => {
    expect(normalizeHealthPayload({ resting_hr: 4 }).restingHr).toBeNull();
    expect(normalizeHealthPayload({ resting_hr: 900 }).restingHr).toBeNull();
    expect(normalizeHealthPayload({ hrv_ms: 4000 }).hrvMs).toBeNull();
  });

  it("returns every field, so a missing one is null rather than absent", () => {
    const { sleepStages, sleepStagesRejected, ...readings } = normalizeHealthPayload({});
    expect(Object.values(readings).every((value) => value === null)).toBe(true);
    expect(Object.keys(readings).sort()).toEqual([
      "activeKcal",
      "hrvMs",
      "restingHr",
      "sleepHours",
      "sleepQuality",
      "steps",
      "vo2max",
    ]);
    // A night nobody reported stages for is four nulls, not four zeroes:
    // zero deep sleep is a finding, and no one made it.
    expect(sleepStages).toEqual({
      awakeMinutes: null,
      remMinutes: null,
      deepMinutes: null,
      coreMinutes: null,
    });
    expect(sleepStagesRejected).toBe(false);
  });
});

describe("normalizeHealthPayload — sleep stages", () => {
  it("takes each stage under the names the sources actually use", () => {
    expect(normalizeHealthPayload({ sleep_rem_minutes: 96 }).sleepStages.remMinutes).toBe(96);
    expect(normalizeHealthPayload({ "REM Sleep": 96 }).sleepStages.remMinutes).toBe(96);
    expect(normalizeHealthPayload({ deep_sleep: "82" }).sleepStages.deepMinutes).toBe(82);
    expect(normalizeHealthPayload({ light_minutes: 214 }).sleepStages.coreMinutes).toBe(214);
    expect(normalizeHealthPayload({ time_awake: 24 }).sleepStages.awakeMinutes).toBe(24);
  });

  it("reads a stage in whatever unit it was sent in", () => {
    expect(normalizeHealthPayload({ rem_hours: 1.5 }).sleepStages.remMinutes).toBe(90);
    expect(normalizeHealthPayload({ rem_sleep: "1.5 h" }).sleepStages.remMinutes).toBe(90);
    expect(normalizeHealthPayload({ rem_sleep: "1h 20m" }).sleepStages.remMinutes).toBe(80);
    expect(normalizeHealthPayload({ rem_sleep: "1:20" }).sleepStages.remMinutes).toBe(80);
    expect(normalizeHealthPayload({ rem_seconds: 5400 }).sleepStages.remMinutes).toBe(90);
    // Above a day it cannot be minutes, whatever the field is called.
    expect(normalizeHealthPayload({ rem_sleep: 5400 }).sleepStages.remMinutes).toBe(90);
  });

  it("refuses stages that add up to more sleep than the source reported", () => {
    // Stages in seconds read as minutes miss by sixtyfold. Storing them would
    // draw a night that never happened.
    const wrong = normalizeHealthPayload({
      sleep_hours: 7.2,
      sleep_rem_minutes: 900,
      sleep_deep_minutes: 400,
      sleep_core_minutes: 200,
    });
    expect(wrong.sleepStagesRejected).toBe(true);
    expect(wrong.sleepStages.remMinutes).toBeNull();
    expect(wrong.sleepStages.deepMinutes).toBeNull();
    expect(wrong.sleepStages.coreMinutes).toBeNull();
    // The rest of the sample survives: a wrong unit on one field is no reason
    // to lose the duration that came with it.
    expect(wrong.sleepHours).toBe(7.2);
  });

  it("allows the rounding gap between a stage total and a reported duration", () => {
    // 7.2 h is 432 minutes; the stages below total 434. That is rounding,
    // not a contradiction.
    const night = normalizeHealthPayload({
      sleep_hours: 7.2,
      sleep_rem_minutes: 96,
      sleep_deep_minutes: 82,
      sleep_core_minutes: 256,
      sleep_awake_minutes: 24,
    });
    expect(night.sleepStagesRejected).toBe(false);
    expect(night.sleepStages).toEqual({
      awakeMinutes: 24,
      remMinutes: 96,
      deepMinutes: 82,
      coreMinutes: 256,
    });
  });

  it("does not count time awake against the time asleep", () => {
    // Awake minutes sit inside the window in bed, not inside the sleep the
    // source reported. Counting them would reject honest nights.
    const night = normalizeHealthPayload({
      sleep_hours: 6,
      sleep_rem_minutes: 80,
      sleep_deep_minutes: 70,
      sleep_core_minutes: 210,
      sleep_awake_minutes: 55,
    });
    expect(night.sleepStagesRejected).toBe(false);
    expect(night.sleepStages.awakeMinutes).toBe(55);
  });

  it("refuses a night longer than a day even with no duration to check against", () => {
    const wrong = normalizeHealthPayload({
      sleep_rem_minutes: 700,
      sleep_deep_minutes: 700,
      sleep_core_minutes: 100,
    });
    expect(wrong.sleepStagesRejected).toBe(true);
    expect(wrong.sleepStages.remMinutes).toBeNull();
  });

  it("keeps stages that arrive without any sleep duration to check against", () => {
    // Nothing contradicts them, so they are stored. What is not done is
    // deriving sleep_hours from them: a derived duration in the column that
    // holds reported ones can never be told apart from a measurement again.
    const partial = normalizeHealthPayload({ sleep_deep_minutes: 82, sleep_rem_minutes: 96 });
    expect(partial.sleepStagesRejected).toBe(false);
    expect(partial.sleepStages.deepMinutes).toBe(82);
    expect(partial.sleepHours).toBeNull();
  });

  it("drops a single stage no night contains, keeping the ones that make sense", () => {
    const night = normalizeHealthPayload({ sleep_rem_minutes: -20, sleep_deep_minutes: 82 });
    expect(night.sleepStages.remMinutes).toBeNull();
    expect(night.sleepStages.deepMinutes).toBe(82);
    expect(night.sleepStagesRejected).toBe(false);
  });
});
