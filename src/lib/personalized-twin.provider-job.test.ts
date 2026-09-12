import { describe, expect, it } from "vitest";
import {
  canPollPersonalizedTwinProvider,
  nextPersonalizedTwinPollAt,
  personalizedTwinPollDelayMs,
} from "./personalized-twin.provider-job";

describe("Personalized Twin provider job policy", () => {
  it("uses bounded exponential backoff", () => {
    expect(personalizedTwinPollDelayMs(0)).toBe(5_000);
    expect(personalizedTwinPollDelayMs(1)).toBe(10_000);
    expect(personalizedTwinPollDelayMs(8)).toBe(300_000);
    expect(personalizedTwinPollDelayMs(99)).toBe(300_000);
  });

  it("polls only processing jobs whose time has arrived", () => {
    const now = new Date("2026-09-11T12:00:00.000Z");
    expect(canPollPersonalizedTwinProvider({ status: "processing", nextPollAt: null, now })).toBe(
      true,
    );
    expect(
      canPollPersonalizedTwinProvider({
        status: "processing",
        nextPollAt: "2026-09-11T12:01:00.000Z",
        now,
      }),
    ).toBe(false);
    expect(canPollPersonalizedTwinProvider({ status: "ready", nextPollAt: null, now })).toBe(false);
    expect(nextPersonalizedTwinPollAt({ attempt: 1, now })).toBe("2026-09-11T12:00:10.000Z");
  });
});
