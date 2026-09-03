import { describe, expect, it } from "vitest";
import {
  IanaTimeZoneSchema,
  browserTimeZone,
  dayOffset,
  dayBoundsInTimeZone,
  dayInTimeZone,
  isDayWithinPastDays,
} from "./local-day";

describe("local-day", () => {
  it("uses the user's calendar day instead of UTC", () => {
    expect(dayInTimeZone(new Date("2026-09-03T21:30:00.000Z"), "Europe/Vilnius")).toBe(
      "2026-09-04",
    );
    expect(dayInTimeZone(new Date("2026-01-01T01:30:00.000Z"), "America/Los_Angeles")).toBe(
      "2025-12-31",
    );
  });

  it("uses real local midnights across a daylight-saving transition", () => {
    expect(dayBoundsInTimeZone("2026-03-29", "Europe/Vilnius")).toEqual({
      start: "2026-03-28T22:00:00.000Z",
      end: "2026-03-29T21:00:00.000Z",
    });
  });

  it("compares date-only facts using local calendar days", () => {
    expect(dayOffset("2026-03-01", -1)).toBe("2026-02-28");
    expect(dayOffset("2026-12-31", 1)).toBe("2027-01-01");
    expect(isDayWithinPastDays("2026-09-04", 7, "2026-09-04")).toBe(true);
    expect(isDayWithinPastDays("2026-08-28", 7, "2026-09-04")).toBe(true);
    expect(isDayWithinPastDays("2026-08-27", 7, "2026-09-04")).toBe(false);
    expect(isDayWithinPastDays("2026-09-05", 7, "2026-09-04")).toBe(false);
  });

  it("rejects invalid or unsupported values at the boundary", () => {
    expect(IanaTimeZoneSchema.safeParse("Not/A_Time_Zone").success).toBe(false);
  });

  it("does not use the server time zone while rendering the browser app", () => {
    expect(browserTimeZone()).toBe("UTC");
  });
});
