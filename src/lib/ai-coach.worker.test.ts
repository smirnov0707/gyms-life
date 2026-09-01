import { describe, expect, it } from "vitest";
import { runCoachWorker } from "./ai-coach.worker";
import type { CoachContext } from "./ai-coach.contract";
import type { AIProviderAdapter } from "./ai-provider.contract";

const context: CoachContext = {
  schemaVersion: "1.0",
  user: { id: "00000000-0000-4000-8000-000000000001" },
  generatedAt: "2026-09-01T00:00:00.000Z",
  goal: "strength",
  activePlan: null,
  performance: { workouts: 1, totalVolumeKg: 100, totalSets: 3, totalReps: 30, averageRpe: 7 },
  insights: [],
  exercises: [],
};

const provider: AIProviderAdapter = {
  provider: "fake",
  model: "test",
  async generate(request) {
    return {
      requestId: request.requestId,
      provider: "fake",
      model: "test",
      recommendation: {
        schemaVersion: "1.0",
        decision: "NO_CHANGE",
        priority: "LOW",
        summary: "Keep plan",
        rationale: ["Stable performance"],
        actions: [{ type: "KEEP_PLAN", exerciseSlug: null, value: null, unit: null, instruction: "Continue the current plan." }],
        confidence: 0.9,
        safety: { requiresUserConfirmation: true, notes: [] },
      },
    };
  },
};

describe("runCoachWorker", () => {
  it("validates a provider recommendation at the boundary", async () => {
    const result = await runCoachWorker(provider, context);
    expect(result.recommendation.decision).toBe("NO_CHANGE");
    expect(result.provider).toBe("fake");
  });
});
