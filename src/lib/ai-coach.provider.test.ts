import { describe, expect, it } from "vitest";
import { createStructuredCoachProvider } from "./ai-coach.provider";
import type { CoachContext } from "./ai-coach.contract";

const context: CoachContext = {
  schemaVersion: "1.0",
  user: { id: "00000000-0000-4000-8000-000000000001" },
  generatedAt: "2026-09-01T00:00:00.000Z",
  goal: "strength",
  activePlan: null,
  performance: { workouts: 4, totalVolumeKg: 2400, totalSets: 24, totalReps: 120, averageRpe: 7.5 },
  insights: [{ exerciseSlug: "bench-press", exerciseName: "Bench Press", signal: "PROGRESSING", confidence: 0.82, evidence: [{ metric: "estimated1RMChangePercent", value: 4.2 }], explanation: "Recent performance is improving.", recommendation: "Consider a small load increase." }],
  exercises: [],
};

const recommendation = { schemaVersion: "1.0", decision: "ADJUST_NEXT_WORKOUT", priority: "MEDIUM", summary: "Increase Bench Press slightly.", rationale: ["Estimated 1RM is trending upward."], actions: [{ type: "INCREASE_LOAD", exerciseSlug: "bench-press", value: 2.5, unit: "kg", instruction: "Add 2.5 kg next session if form remains solid." }], confidence: 0.8, safety: { requiresUserConfirmation: true, notes: ["Derived from recent completed sets."] } };

describe("structured coach provider", () => {
  it("passes structured context to the provider and validates its output", async () => {
    let received = "";
    const provider = createStructuredCoachProvider(async ({ system, user, jsonSchema }) => {
      received = `${system}|${user}|${String(jsonSchema)}`;
      return recommendation;
    });
    const result = await provider.generateRecommendation(context);
    expect(result.actions[0]?.exerciseSlug).toBe("bench-press");
    expect(received).toContain("CoachRecommendationSchema:v1");
    expect(received).toContain("bench-press");
  });

  it("rejects malformed provider output", async () => {
    const provider = createStructuredCoachProvider(async () => ({ nope: true }));
    await expect(provider.generateRecommendation(context)).rejects.toThrow();
  });
});
