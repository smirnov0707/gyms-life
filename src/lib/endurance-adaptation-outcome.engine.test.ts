import { describe, expect, it } from "vitest";
import { assessAdaptationOutcome } from "./endurance-adaptation-outcome.engine";

describe("adaptation outcome", () => {
  it("does not evaluate too early", () => {
    expect(
      assessAdaptationOutcome({
        sessionsAfter: 1,
        ratedResponsesAfter: 1,
        lowResponseStreakAfter: 0,
        readinessBandAfter: "high",
        daysObserved: 1,
      }).status,
    ).toBe("too_early");
  });

  it("never claims causality", () => {
    expect(
      assessAdaptationOutcome({
        sessionsAfter: 2,
        ratedResponsesAfter: 2,
        lowResponseStreakAfter: 0,
        readinessBandAfter: "high",
        daysObserved: 4,
      }).causalClaim,
    ).toBe(false);
  });

  it("does not call absence of post-adaptation evidence mixed", () => {
    expect(
      assessAdaptationOutcome({
        sessionsAfter: 0,
        ratedResponsesAfter: 0,
        lowResponseStreakAfter: 0,
        readinessBandAfter: "unknown",
        daysObserved: 4,
      }).association,
    ).toBe("insufficient_signal");
  });

  it("requires repeated rated low response before calling signals worse", () => {
    expect(
      assessAdaptationOutcome({
        sessionsAfter: 2,
        ratedResponsesAfter: 2,
        lowResponseStreakAfter: 2,
        readinessBandAfter: "low",
        daysObserved: 4,
      }).association,
    ).toBe("worse_signals");
  });
});
