import { describe, expect, it } from "vitest";
import { CoachRecommendationSchema } from "./ai-coach.contract";

describe("CoachRecommendationSchema", () => {
  it("accepts a safe recommendation contract", () => {
    const result = CoachRecommendationSchema.parse({
      schemaVersion: "1.0",
      decision: "ADJUST_NEXT_WORKOUT",
      priority: "MEDIUM",
      summary: "Increase the next set slightly.",
      rationale: ["Recent performance is stable."],
      actions: [
        {
          type: "INCREASE_LOAD",
          exerciseSlug: "bench-press",
          value: 2.5,
          unit: "kg",
          instruction: "Add 2.5 kg next session.",
        },
      ],
      confidence: 0.82,
      safety: { requiresUserConfirmation: true, notes: [] },
    });
    expect(result.actions[0]?.value).toBe(2.5);
  });

  it("rejects unsupported decisions", () => {
    expect(() =>
      CoachRecommendationSchema.parse({
        schemaVersion: "1.0",
        decision: "CHANGE_FOREVER",
        priority: "HIGH",
        summary: "x",
        rationale: [],
        actions: [],
        confidence: 1,
        safety: { requiresUserConfirmation: true, notes: [] },
      }),
    ).toThrow();
  });
});
