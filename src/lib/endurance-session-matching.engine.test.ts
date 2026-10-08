import { describe, expect, it } from "vitest";
import { matchCompletedRunToPlan } from "./endurance-session-matching.engine";
const s = (intent: "easy" | "tempo" | "long", d: number, sessionKey: string) => ({
  sessionKey,
  intent,
  plannedDurationMinutes: null,
  plannedDistanceMeters: d,
  intensityCue: intent,
});
describe("endurance session matching", () => {
  it("confidently matches distance plus aligned effort", () => {
    expect(
      matchCompletedRunToPlan(
        [s("easy", 5000, "w1-s1"), s("tempo", 8000, "w1-s2"), s("long", 14000, "w1-s3")],
        { distanceMeters: 8100, durationMinutes: 45, perceivedEffort: 7 },
      ),
    ).toMatchObject({ status: "confident", plannedIndex: 1, plannedSessionKey: "w1-s2" });
  });
  it("requires confirmation when only distance is known", () => {
    expect(
      matchCompletedRunToPlan([s("easy", 5000, "w1-s1"), s("long", 12000, "w1-s2")], {
        distanceMeters: 11800,
        durationMinutes: 70,
        perceivedEffort: null,
      }).status,
    ).toBe("needs_confirmation");
  });
  it("does not force a match when evidence is weak", () => {
    expect(
      matchCompletedRunToPlan([s("easy", 5000, "w1-s1")], {
        distanceMeters: 15000,
        durationMinutes: 90,
        perceivedEffort: 5,
      }).status,
    ).toBe("no_match");
  });
});
