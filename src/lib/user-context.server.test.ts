import { describe, expect, it } from "vitest";
import {
  buildAiPersonalizationSummary,
  calculateWorkoutStreak,
  contextForAi,
  parseAiProfilePreferences,
  resolvePersistedProfileTimeZone,
  type CentralUserContext,
} from "./user-context.server";
import type { DigitalAthleteState } from "./digital-athlete.schema";

const digitalAthlete: DigitalAthleteState = {
  schemaVersion: "1.5" as const,
  training: {
    sessionsLast7Days: 3,
    sessionsLast28Days: 10,
    totalVolumeLast28Days: 7000,
    daysSinceLastCompletedWorkout: 1,
    selfReportedResponse: {
      source: "user_reported",
      available: true,
      ratedSessionsLast28Days: 3,
      latestFeeling: 4,
      averageFeelingLast28Days: 3.7,
    },
  },
  recovery: {
    checkinsLast7Days: 4,
    latestReadinessScore: 70,
    averageReadinessLast7Days: 68,
    averageSleepHoursLast7Days: 7.2,
  },
  body: {
    measurementsLast30Days: 3,
    latestWeightKg: 80,
    latestBodyFatPercent: 18,
    weightChangeKgLast30Days: -0.8,
  },
  nutrition: {
    loggedDaysLast14Days: 7,
    averageCaloriesOnLoggedDays: 2200,
    averageProteinGOnLoggedDays: 155,
  },
  currentDay: {
    day: "2026-09-03",
    weekday: 3,
    hasCompletedReadiness: true,
    hasCompletedWorkout: false,
    hasLoggedNutrition: false,
  },
  behavior: {
    status: "measured" as const,
    preferredWeekdays: [1, 3, 5],
    usualTrainingDaysLast28Days: 12,
    completedUsualTrainingDaysLast28Days: 8,
    completedFlexibleTrainingDaysLast28Days: 2,
    usualDayCompletionRateLast28Days: 0.67,
  },
  decisionFeedback: {
    available: true,
    ratedDecisionsLast28Days: 0,
    helpfulDecisionOutcomesLast28Days: 0,
    notHelpfulDecisionOutcomesLast28Days: 0,
    helpfulnessRate: null,
  },
  currentContext: {
    active: [
      {
        id: "018f2e48-5e6d-7b8c-9d0e-1f2a3b4c5d6e",
        content: "Private context summary",
        expiresAt: "2026-09-03T12:00:00.000Z",
        context: { kind: "time_limited" as const, minutes: 30, note: "Private context note" },
      },
    ],
    shortestAvailableSessionMinutes: 30,
    hasTrainingConstraint: true,
    hasSafetyConstraint: false,
  },
  dataQuality: {
    level: "informed" as const,
    evidenceCount: 24,
    availableDomains: ["training", "recovery", "body", "nutrition"],
  },
  dataGaps: [],
};

const activeMemory = {
  available: true,
  entries: [
    {
      type: "preference" as const,
      content: "Prefers sessions closer to 45 minutes.",
      source: "user_reported" as const,
      confidence: 1,
      importance: 0.8,
    },
  ],
};

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
        selfReportedResponse: {
          source: "user_reported",
          available: true,
          ratedSessionsLast28Days: 0,
          latestFeeling: null,
          averageFeelingLast28Days: null,
        },
      },
      recovery: {
        checkinsLast7Days: 2,
        latestReadinessScore: 72,
        averageReadinessLast7Days: 70,
        averageSleepHoursLast7Days: 7,
      },
      body: {
        measurementsLast30Days: 2,
        latestWeightKg: 80,
        latestBodyFatPercent: 18,
        weightChangeKgLast30Days: -1.2,
      },
      dataGaps: [],
    });
  });
});

describe("parseAiProfilePreferences", () => {
  it("maps legacy preference values to the one AI-safe vocabulary", () => {
    expect(
      parseAiProfilePreferences({
        locale: "lt",
        goal: "build_muscle",
        experience: "intermediate",
        days_per_week: 4,
        session_minutes: 60,
        equipment: ["Dumbbells", "pull-up bar", "unknown"],
      }),
    ).toEqual({
      locale: "lt",
      goal: "muscle_gain",
      experience: "intermediate",
      daysPerWeek: 4,
      sessionMinutes: 60,
      equipment: ["dumbbell", "pullup_bar"],
    });
  });

  it("rejects malformed source rows instead of forwarding them into AI context", () => {
    expect(parseAiProfilePreferences({ locale: "lt" })).toBeNull();
  });
});

describe("resolvePersistedProfileTimeZone", () => {
  it("uses only validated IANA names and safely falls back for invalid legacy data", () => {
    expect(resolvePersistedProfileTimeZone("Europe/Vilnius")).toBe("Europe/Vilnius");
    expect(resolvePersistedProfileTimeZone("not-a-time-zone")).toBe("UTC");
    expect(resolvePersistedProfileTimeZone(null)).toBe("UTC");
  });
});

describe("calculateWorkoutStreak", () => {
  it("normalizes completed sessions into the caller's local calendar days", () => {
    expect(
      calculateWorkoutStreak(
        ["2026-09-03T21:30:00.000Z", "2026-09-02T22:00:00.000Z", "2026-09-01T21:30:00.000Z"],
        "Europe/Vilnius",
        new Date("2026-09-03T21:45:00.000Z"),
      ),
    ).toBe(3);
  });
});

describe("contextForAi", () => {
  it("excludes identity, raw current context, free-text notes, and calendar dates", () => {
    const context = {
      profile: {
        locale: "lt",
        goal: "strength",
        experience: "intermediate",
        daysPerWeek: 4,
        sessionMinutes: 60,
        equipment: ["barbell"],
      },
      currentDay: {
        nutrition: {
          available: true,
          calories: 1800,
          proteinG: 150,
          carbsG: 160,
          fatG: 55,
          targetCalories: 2400,
          targetProteinG: 170,
          remainingCalories: 600,
          remainingProteinG: 20,
        },
        recentSession: { totalSets: 18, averageRpe: 7.75, fatigueLevel: "medium" as const },
        dataGaps: [],
      },
      aiPersonalization: {
        enabled: true,
        policyVersion: "2026-09-03-memory-context-v1",
        lastRecordedAt: "2026-09-01T00:00:00.000Z",
      },
      digitalAthlete,
      activeMemory,
      dataGaps: [],
    } satisfies CentralUserContext;

    const payload = contextForAi(context);

    for (const privateValue of [
      "Private context summary",
      "Private context note",
      "2026-09-01",
      "018f2e48",
    ]) {
      expect(payload).not.toContain(privateValue);
    }
    expect(JSON.parse(payload)).toMatchObject({
      schemaVersion: "1.5",
      preferences: { goal: "strength", daysPerWeek: 4 },
      personalization: { enabled: true, policyVersion: "2026-09-03-memory-context-v1" },
      nutritionToday: { calories: 1800, targetCalories: 2400 },
      recentSession: { totalSets: 18, averageRpe: 7.8, fatigueLevel: "medium" },
      athleteModel: {
        training: {
          sessionsLast28Days: 10,
          selfReportedResponse: {
            source: "user_reported",
            ratedSessionsLast28Days: 3,
            latestFeeling: 4,
          },
        },
        recovery: { latestReadinessScore: 70 },
        currentContext: { shortestAvailableSessionMinutes: 30 },
      },
      activeMemory: activeMemory.entries,
    });
  });

  it("withholds aggregate health, nutrition, and performance data until the user opts in", () => {
    const context = {
      profile: {
        locale: "lt",
        goal: "strength",
        experience: "intermediate",
        daysPerWeek: 4,
        sessionMinutes: 60,
        equipment: ["barbell"],
      },
      currentDay: {
        nutrition: {
          available: true,
          calories: 1800,
          proteinG: 150,
          carbsG: 160,
          fatG: 55,
          targetCalories: 2400,
          targetProteinG: 170,
          remainingCalories: 600,
          remainingProteinG: 20,
        },
        recentSession: { totalSets: 18, averageRpe: 7.75, fatigueLevel: "medium" as const },
        dataGaps: [],
      },
      aiPersonalization: {
        enabled: false,
        policyVersion: null,
        lastRecordedAt: null,
      },
      digitalAthlete,
      activeMemory,
      dataGaps: ["personalization_consent_required"],
    } satisfies CentralUserContext;

    const payload = contextForAi(context);

    expect(JSON.parse(payload)).toMatchObject({
      schemaVersion: "1.5",
      personalization: { enabled: false },
      dataGaps: ["personalization_consent_required"],
    });
    for (const withheldField of [
      "nutritionToday",
      "recentSession",
      "athleteModel",
      "1800",
      "7000",
    ]) {
      expect(payload).not.toContain(withheldField);
    }
  });
});
