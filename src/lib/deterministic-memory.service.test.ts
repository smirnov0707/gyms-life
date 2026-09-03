import { describe, expect, it } from "vitest";
import { buildCalculatedMemoryCandidates } from "./deterministic-memory.service";
import type { DigitalAthleteState } from "./digital-athlete.schema";

const completeState: DigitalAthleteState = {
  schemaVersion: "1.2",
  training: {
    sessionsLast7Days: 3,
    sessionsLast28Days: 10,
    totalVolumeLast28Days: 14_200,
    daysSinceLastCompletedWorkout: 1,
  },
  recovery: {
    checkinsLast7Days: 4,
    latestReadinessScore: 48,
    averageReadinessLast7Days: 52.5,
    averageSleepHoursLast7Days: 6.4,
  },
  body: {
    measurementsLast30Days: 3,
    latestWeightKg: 79.2,
    latestBodyFatPercent: null,
    weightChangeKgLast30Days: -1.4,
  },
  nutrition: {
    loggedDaysLast14Days: 11,
    averageCaloriesOnLoggedDays: 2_120,
    averageProteinGOnLoggedDays: 154,
  },
  decisionFeedback: {
    available: true,
    ratedDecisionsLast28Days: 3,
    helpfulDecisionOutcomesLast28Days: 2,
    notHelpfulDecisionOutcomesLast28Days: 1,
    helpfulnessRate: 0.67,
  },
  currentContext: {
    active: [],
    shortestAvailableSessionMinutes: null,
    hasTrainingConstraint: false,
    hasSafetyConstraint: false,
  },
  dataQuality: {
    level: "informed",
    evidenceCount: 28,
    availableDomains: ["training", "recovery", "body", "nutrition"],
  },
  dataGaps: [],
};

describe("calculated user memory", () => {
  it("creates bounded, evidence-ready claims only from sufficient observed data", () => {
    const candidates = buildCalculatedMemoryCandidates(completeState);

    expect(candidates.map((candidate) => candidate.memoryKey)).toEqual([
      "derived:training_consistency_28d",
      "derived:recovery_low_7d",
      "derived:weight_change_30d",
      "derived:nutrition_logging_14d",
    ]);
    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          memoryType: "recovery_pattern",
          confidence: 0.8,
          value: {
            kind: "recovery_low_7d",
            averageReadiness: 52.5,
            checkinsLast7Days: 4,
            windowDays: 7,
          },
        }),
        expect.objectContaining({
          content: "Recorded weight changed by -1.4 kg across 3 measurements in the last 30 days.",
        }),
      ]),
    );
  });

  it("does not manufacture insights when evidence is insufficient", () => {
    const candidates = buildCalculatedMemoryCandidates({
      ...completeState,
      training: { ...completeState.training, sessionsLast28Days: 7 },
      recovery: {
        ...completeState.recovery,
        checkinsLast7Days: 2,
        averageReadinessLast7Days: 40,
      },
      body: {
        ...completeState.body,
        measurementsLast30Days: 1,
        weightChangeKgLast30Days: null,
      },
      nutrition: { ...completeState.nutrition, loggedDaysLast14Days: 9 },
    });

    expect(candidates).toEqual([]);
  });
});
