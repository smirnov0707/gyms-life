import { describe, expect, it } from "vitest";
import {
  buildAiPersonalizationSummary,
  contextForAi,
  type CentralUserContext,
} from "./user-context.server";

describe("buildAiPersonalizationSummary", () => {
  it("derives bounded, date-free trends from owned database rows", () => {
    const now = new Date("2026-09-02T12:00:00.000Z");
    const summary = buildAiPersonalizationSummary(
      {
        workouts: [
          { started_at: "2026-09-01T09:00:00.000Z", total_volume: 1200 },
          { started_at: "2026-08-20T09:00:00.000Z", total_volume: 800 },
          { started_at: "2026-07-01T09:00:00.000Z", total_volume: 900 },
        ],
        checkins: [
          { checkin_on: "2026-09-02", readiness_score: 72, sleep_hours: 7.5 },
          { checkin_on: "2026-08-30", readiness_score: 68, sleep_hours: 6.5 },
        ],
        bodyMetrics: [
          { measured_on: "2026-09-01", weight_kg: 80, body_fat: 18 },
          { measured_on: "2026-08-10", weight_kg: 81.2, body_fat: 18.5 },
        ],
        availability: { training: true, recovery: true, body: true },
      },
      now,
    );

    expect(summary).toEqual({
      training: {
        sessionsLast7Days: 1,
        sessionsLast28Days: 2,
        totalVolumeLast28Days: 2000,
        daysSinceLastCompletedWorkout: 1,
      },
      recovery: {
        latestReadinessScore: 72,
        averageReadinessLast7Days: 70,
        averageSleepHoursLast7Days: 7,
      },
      body: {
        latestWeightKg: 80,
        latestBodyFatPercent: 18,
        weightChangeKgLast30Days: -1.2,
      },
      dataGaps: [],
    });
  });
});

describe("contextForAi", () => {
  it("excludes identity, raw biometrics, free-text memory, and calendar dates", () => {
    const context = {
      profile: {
        displayName: "Private athlete",
        locale: "lt",
        goal: "strength",
        experience: "intermediate",
        heightCm: 181,
        weightKg: 80,
        targetWeightKg: 84,
        daysPerWeek: 4,
        sessionMinutes: 60,
        equipment: ["barbell"],
        limitations: "Private limitation",
        diet: "omnivore",
        allergies: "Private allergy",
        dislikes: "Private dislike",
        mealsPerDay: 3,
      },
      biometric: {
        userId: "private-user-id",
        todayNutrition: {
          calories: 1800,
          proteinG: 150,
          carbsG: 160,
          fatG: 55,
          targetCalories: 2400,
          targetProteinG: 170,
          remainingCalories: 600,
          remainingProteinG: 20,
        },
        recentWorkout: {
          date: "2026-09-01T09:00:00.000Z",
          focus: "Private session title",
          totalSets: 18,
          avgRpe: 7.75,
          fatigueLevel: "medium",
        },
        healthBiomarkers: { restingHr: 52, hrvMs: 61, notes: "Private health note" },
        activeGoal: "strength",
      },
      aiPersonalization: {
        enabled: true,
        policyVersion: "2026-09-02",
        lastRecordedAt: "2026-09-01T00:00:00.000Z",
      },
      aiSummary: {
        training: {
          sessionsLast7Days: 3,
          sessionsLast28Days: 10,
          totalVolumeLast28Days: 7000,
          daysSinceLastCompletedWorkout: 1,
        },
        recovery: {
          latestReadinessScore: 70,
          averageReadinessLast7Days: 68,
          averageSleepHoursLast7Days: 7.2,
        },
        body: {
          latestWeightKg: 80,
          latestBodyFatPercent: 18,
          weightChangeKgLast30Days: -0.8,
        },
        dataGaps: [],
      },
      digitalAthlete: {
        schemaVersion: "1.0",
        training: {
          sessionsLast7Days: 3,
          sessionsLast28Days: 10,
          totalVolumeLast28Days: 7000,
          daysSinceLastCompletedWorkout: 1,
        },
        recovery: {
          latestReadinessScore: 70,
          averageReadinessLast7Days: 68,
          averageSleepHoursLast7Days: 7.2,
        },
        body: {
          latestWeightKg: 80,
          latestBodyFatPercent: 18,
          weightChangeKgLast30Days: -0.8,
        },
        nutrition: {
          loggedDaysLast14Days: 7,
          averageCaloriesOnLoggedDays: 2200,
          averageProteinGOnLoggedDays: 155,
        },
        currentContext: {
          active: [
            {
              id: "018f2e48-5e6d-7b8c-9d0e-1f2a3b4c5d6e",
              content: "Private context summary",
              expiresAt: "2026-09-03T12:00:00.000Z",
              context: { kind: "time_limited", minutes: 30, note: "Private context note" },
            },
          ],
          shortestAvailableSessionMinutes: 30,
          hasTrainingConstraint: true,
          hasSafetyConstraint: false,
        },
        dataQuality: {
          level: "informed",
          evidenceCount: 24,
          availableDomains: ["training", "recovery", "body", "nutrition"],
        },
        dataGaps: [],
      },
      memory: [
        {
          type: "private",
          content: "Private memory",
          confidence: 1,
          importance: 1,
          lastConfirmedAt: "2026-09-01T00:00:00.000Z",
        },
      ],
    } satisfies CentralUserContext;

    const payload = contextForAi(context);

    for (const privateValue of [
      "Private athlete",
      "private-user-id",
      "Private limitation",
      "Private allergy",
      "Private dislike",
      "Private session title",
      "Private health note",
      "Private memory",
      "Private context summary",
      "Private context note",
      "2026-09-01",
    ]) {
      expect(payload).not.toContain(privateValue);
    }
    expect(JSON.parse(payload)).toMatchObject({
      preferences: { goal: "strength", trainingDaysPerWeek: 4 },
      personalization: { enabled: true, policyVersion: "2026-09-02" },
      recentSession: { totalSets: 18, averageRpe: 7.8, fatigueLevel: "medium" },
      trainingHistory: { sessionsLast28Days: 10 },
      recovery: { latestReadinessScore: 70 },
      athleteModel: { currentContext: { shortestAvailableSessionMinutes: 30 } },
    });
  });

  it("withholds aggregate health and behavior data until the user opts in", () => {
    const context = {
      profile: {
        displayName: null,
        locale: "lt",
        goal: "strength",
        experience: "intermediate",
        heightCm: null,
        weightKg: null,
        targetWeightKg: null,
        daysPerWeek: 4,
        sessionMinutes: 60,
        equipment: ["barbell"],
        limitations: null,
        diet: "omnivore",
        allergies: null,
        dislikes: null,
        mealsPerDay: 3,
      },
      biometric: {
        userId: "private-user-id",
        todayNutrition: {
          calories: 1800,
          proteinG: 150,
          carbsG: 160,
          fatG: 55,
          targetCalories: 2400,
          targetProteinG: 170,
          remainingCalories: 600,
          remainingProteinG: 20,
        },
        activeGoal: "strength",
      },
      aiPersonalization: {
        enabled: false,
        policyVersion: null,
        lastRecordedAt: null,
      },
      aiSummary: {
        training: {
          sessionsLast7Days: 3,
          sessionsLast28Days: 10,
          totalVolumeLast28Days: 7000,
          daysSinceLastCompletedWorkout: 1,
        },
        recovery: {
          latestReadinessScore: 70,
          averageReadinessLast7Days: 68,
          averageSleepHoursLast7Days: 7.2,
        },
        body: {
          latestWeightKg: 80,
          latestBodyFatPercent: 18,
          weightChangeKgLast30Days: -0.8,
        },
        dataGaps: ["personalization_consent_required"],
      },
      digitalAthlete: {
        schemaVersion: "1.0",
        training: {
          sessionsLast7Days: 3,
          sessionsLast28Days: 10,
          totalVolumeLast28Days: 7000,
          daysSinceLastCompletedWorkout: 1,
        },
        recovery: {
          latestReadinessScore: 70,
          averageReadinessLast7Days: 68,
          averageSleepHoursLast7Days: 7.2,
        },
        body: {
          latestWeightKg: 80,
          latestBodyFatPercent: 18,
          weightChangeKgLast30Days: -0.8,
        },
        nutrition: {
          loggedDaysLast14Days: 7,
          averageCaloriesOnLoggedDays: 2200,
          averageProteinGOnLoggedDays: 155,
        },
        currentContext: {
          active: [],
          shortestAvailableSessionMinutes: null,
          hasTrainingConstraint: false,
          hasSafetyConstraint: false,
        },
        dataQuality: {
          level: "informed",
          evidenceCount: 24,
          availableDomains: ["training", "recovery", "body", "nutrition"],
        },
        dataGaps: [],
      },
      memory: [],
    } satisfies CentralUserContext;

    const payload = contextForAi(context);

    expect(JSON.parse(payload)).toMatchObject({
      personalization: { enabled: false },
      dataGaps: ["personalization_consent_required"],
    });
    for (const withheldField of [
      "nutritionToday",
      "recentSession",
      "trainingHistory",
      "recovery",
      "bodyTrend",
      "1800",
      "7000",
    ]) {
      expect(payload).not.toContain(withheldField);
    }
  });
});
