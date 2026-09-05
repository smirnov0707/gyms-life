import { describe, expect, it } from "vitest";
import {
  PERFORMED_AT_FUTURE_TOLERANCE_MS,
  PERFORMED_AT_MAX_AGE_MS,
  resolvePerformedAt,
} from "./performed-at.engine";

const now = new Date("2026-09-05T09:00:00.000Z");

describe("resolvePerformedAt", () => {
  it("keeps the instant a set was actually performed", () => {
    // The whole point: a set done at 19:00 and synced next morning must not
    // be dated to the morning, or the Twin decays fatigue from the wrong hour.
    const lastNight = "2026-09-04T19:00:00.000Z";
    expect(resolvePerformedAt(lastNight, now).toISOString()).toBe(lastNight);
  });

  it("falls back to arrival time when the client says nothing", () => {
    expect(resolvePerformedAt(null, now)).toEqual(now);
    expect(resolvePerformedAt(undefined, now)).toEqual(now);
  });

  it("falls back to arrival time rather than trusting an unparseable value", () => {
    for (const value of ["", "not-a-date", "2026-13-45T99:00:00Z"]) {
      expect(resolvePerformedAt(value, now), value).toEqual(now);
    }
  });

  it("tolerates ordinary clock skew ahead of the server", () => {
    const slightlyAhead = new Date(now.getTime() + PERFORMED_AT_FUTURE_TOLERANCE_MS - 1000);
    expect(resolvePerformedAt(slightlyAhead.toISOString(), now)).toEqual(slightlyAhead);
  });

  it("refuses a future date that would park fatigue ahead of now", () => {
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    expect(resolvePerformedAt(tomorrow.toISOString(), now)).toEqual(now);
  });

  it("clamps a far-backdated set instead of discarding the set", () => {
    const ancient = new Date(now.getTime() - PERFORMED_AT_MAX_AGE_MS - 60_000);
    // The set still happened; only its claimed date is unusable.
    expect(resolvePerformedAt(ancient.toISOString(), now)).toEqual(
      new Date(now.getTime() - PERFORMED_AT_MAX_AGE_MS),
    );
  });
});
