import { describe, expect, it } from "vitest";
import { requestCoachRecommendation } from "./ai-coach.orchestrator";
import type { CoachContext } from "./ai-coach.contract";

const context: CoachContext = { schemaVersion: "1.0", user: { id: "00000000-0000-4000-8000-000000000001" }, generatedAt: "2026-09-01T00:00:00.000Z", goal: "strength", activePlan: null, performance: { workouts: 1, totalVolumeKg: 100, totalSets: 3, totalReps: 30, averageRpe: 7 }, insights: [], exercises: [] };

describe("requestCoachRecommendation", () => {
  it("passes context to the provider and validates the response", async () => {
    const result = await requestCoachRecommendation({ context, provider: { provider: "fake", model: "test", async generate(request) { return { requestId: request.requestId, provider: "fake", model: "test", recommendation: { schemaVersion: "1.0", decision: "NO_CHANGE", priority: "LOW", summary: "Continue", rationale: ["Stable"], actions: [{ type: "KEEP_PLAN", exerciseSlug: null, value: null, unit: null, instruction: "Continue." }], confidence: 0.9, safety: { requiresUserConfirmation: true, notes: [] } } }; } } });
    expect(result.provider).toBe("fake");
    expect(result.recommendation.decision).toBe("NO_CHANGE");
  });
});
