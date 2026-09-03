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
      performanceForecast: {
        status: "learning",
        forecastVersion: "1.0",
        sourceWindowDays: 120,
        eligibleLiftCount: 0,
        minimumSessionCount: 4,
        minimumSpanDays: 21,
        lifts: [],
      },
    });

    expect(context.schemaVersion).toBe("1.1");
    expect(context.performance.totalVolumeKg).toBe(1200);
    expect(context.activePlan?.title).toBe("Strength");
    expect(context.performanceSignals).toEqual([]);
  });

  it("passes only canonical forecast facts to the provider-neutral worker", () => {
    const context = buildCoachContext({
      userId: "00000000-0000-4000-8000-000000000001",
      performance: {
        metrics: {
          workouts: 4,
          totalVolume: 3200,
          totalDurationSeconds: 5400,
          totalSets: 24,
          totalReps: 120,
          averageRpe: 7.5,
        },
        exercises: [],
      },
      performanceForecast: {
        status: "ready",
        forecastVersion: "1.0",
        sourceWindowDays: 120,
        lifts: [
          {
            exerciseSlug: "bench-press",
            exerciseName: "Bench Press",
            currentEstimated1RMKg: 100,
            projected4WeeksEstimated1RMKg: 102,
            projected12WeeksEstimated1RMKg: 104,
            trend: "rising",
            evidenceStrength: "moderate",
            evidence: {
              sessionCount: 8,
              weeksTracked: 6,
              spanDays: 56,
              averageRpe: 7.5,
              observedWeeklyChangeKg: 0.5,
            },
          },
        ],
      },
    });

    expect(context.performanceSignals).toEqual([
      expect.objectContaining({
        exerciseSlug: "bench-press",
        trend: "rising",
        evidenceStrength: "moderate",
      }),
    ]);
    expect(context.performanceSignals[0]).not.toHaveProperty("recommendation");
    expect(context.performanceSignals[0]).not.toHaveProperty("confidence");
  });
});
