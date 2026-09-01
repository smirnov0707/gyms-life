import { describe, expect, it } from "vitest";
import { createProviderRequest } from "./ai-provider.contract";
import { createCoachContext } from "./ai-coach.contract";

describe("AI provider contract", () => {
  it("sends only validated CoachContext", () => {
    const context = createCoachContext({ user: { id: "00000000-0000-4000-8000-000000000001" }, generatedAt: "2026-09-01T00:00:00.000Z", goal: null, activePlan: null, performance: { workouts: 0, totalVolumeKg: 0, totalSets: 0, totalReps: 0, averageRpe: null }, insights: [], exercises: [] });
    const request = createProviderRequest("00000000-0000-4000-8000-000000000003", context);
    expect(request.task).toBe("COACH_RECOMMENDATION");
    expect(request.context).toEqual(context);
    expect(request).not.toHaveProperty("supabase");
    expect(request).not.toHaveProperty("db");
  });
});
