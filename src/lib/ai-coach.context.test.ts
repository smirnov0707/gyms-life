import { describe, expect, it } from "vitest";
import { buildCoachContext } from "./ai-coach.context";

describe("buildCoachContext", () => {
  it("builds a provider-neutral validated context", () => {
    const context = buildCoachContext({
      userId: "00000000-0000-4000-8000-000000000001",
      goal: "strength",
      activePlan: {
        id: "00000000-0000-4000-8000-000000000002",
        title: "Strength",
        dayIndex: 1,
      },
      performance: {
        metrics: {
          workouts: 3,
          totalVolume: 1200,
          totalDurationSeconds: 3600,
          totalSets: 18,
          totalReps: 90,
          averageRpe: 7.8,
        },
        exercises: [],
      },
      insights: [],
    });

    expect(context.schemaVersion).toBe("1.0");
    expect(context.performance.totalVolumeKg).toBe(1200);
    expect(context.activePlan?.title).toBe("Strength");
  });
});
