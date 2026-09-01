import { describe, expect, it } from "vitest";
import { runCoachWorker } from "./ai-coach.worker";
import type { CoachContext } from "./ai-coach.contract";

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

describe("runCoachWorker", () => {
  it("validates a worker recommendation at the boundary", async () => {
    const result = await runCoachWorker({ name: "fake", version: "test", async generateRecommendation() {
      return { schemaVersion: "1.0", decision: "NO_CHANGE", priority: "LOW", summary: "Keep plan", rationale: ["Stable performance"], actions: [{ type: "KEEP_PLAN", exerciseSlug: null, value: null, unit: null, instruction: "Continue the current plan." }], confidence: 0.9, safety: { requiresUserConfirmation: true, notes: [] } };
    } }, context);
    expect(result.decision).toBe("NO_CHANGE");
  });
});
