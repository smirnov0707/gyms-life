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
    const empty = normalizeHealthPayload({});
    expect(Object.values(empty).every((value) => value === null)).toBe(true);
    expect(Object.keys(empty).sort()).toEqual([
      "activeKcal",
      "hrvMs",
      "restingHr",
      "sleepHours",
      "sleepQuality",
      "steps",
      "vo2max",
    ]);
  });
});
