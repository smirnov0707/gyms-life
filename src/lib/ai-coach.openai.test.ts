import { describe, expect, it } from "vitest";
import { parseCoachRecommendation } from "./ai-coach.contract";

describe("OpenAI coach output contract", () => {
  it("accepts a strict recommendation payload", () => {
    const result = parseCoachRecommendation({
      schemaVersion: "1.0",
      decision: "ADJUST_NEXT_WORKOUT",
      priority: "MEDIUM",
      summary: "Increase the next working weight slightly.",
      rationale: ["Recent performance is improving."],
      actions: [{ type: "INCREASE_LOAD", exerciseSlug: "bench-press", value: 2.5, unit: "kg", instruction: "Add 2.5 kg next session if all prescribed reps are completed." }],
      confidence: 0.82,
      safety: { requiresUserConfirmation: true, notes: ["Stop if pain occurs."] },
    });
    expect(result.confidence).toBe(0.82);
  });

  it("rejects malformed model output", () => {
    expect(() => parseCoachRecommendation({ schemaVersion: "1.0", decision: "bad" })).toThrow();
  });
});
