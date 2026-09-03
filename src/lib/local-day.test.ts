import { describe, expect, it } from "vitest";
import {
  IanaTimeZoneSchema,
  browserTimeZone,
  dayBoundsInTimeZone,
  dayInTimeZone,
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

  it("rejects invalid or unsupported values at the boundary", () => {
    expect(IanaTimeZoneSchema.safeParse("Not/A_Time_Zone").success).toBe(false);
  });

  it("does not use the server time zone while rendering the browser app", () => {
    expect(browserTimeZone()).toBe("UTC");
  });
});
