import { describe, expect, it } from "vitest";
import { DigitalAthleteStateSchema } from "./digital-athlete.schema";
import {
  canPersistDigitalAthleteState,
  fingerprintDigitalAthleteState,
} from "./athlete-state-snapshot.server";

const informedState = DigitalAthleteStateSchema.parse({
  schemaVersion: "1.0",
  training: {
    sessionsLast7Days: 3,
    sessionsLast28Days: 10,
    totalVolumeLast28Days: 8200,
    daysSinceLastCompletedWorkout: 1,
  },
  recovery: {
    latestReadinessScore: 74,
    averageReadinessLast7Days: 71,
    averageSleepHoursLast7Days: 7.4,
  },
  body: { latestWeightKg: 80, latestBodyFatPercent: 18, weightChangeKgLast30Days: -0.7 },
  nutrition: {
    loggedDaysLast14Days: 9,
    averageCaloriesOnLoggedDays: 2360,
    averageProteinGOnLoggedDays: 164,
  },
  currentContext: {
    active: [],
    shortestAvailableSessionMinutes: null,
    hasTrainingConstraint: false,
    hasSafetyConstraint: false,
  },
  dataQuality: {
    level: "informed",
    evidenceCount: 31,
    availableDomains: ["training", "recovery", "body", "nutrition"],
  },
  dataGaps: [],
});

describe("Digital Athlete snapshot persistence", () => {
  it("uses a stable SHA-256 fingerprint for the same validated state", () => {
    const sameState = DigitalAthleteStateSchema.parse(JSON.parse(JSON.stringify(informedState)));

    expect(fingerprintDigitalAthleteState(informedState)).toMatch(/^[a-f0-9]{64}$/);
    expect(fingerprintDigitalAthleteState(sameState)).toBe(
      fingerprintDigitalAthleteState(informedState),
    );
  });

  it("does not retain a snapshot when a source query was unavailable", () => {
    const unavailableState = DigitalAthleteStateSchema.parse({
      ...informedState,
      dataGaps: ["nutrition_data_unavailable"],
    });

    expect(canPersistDigitalAthleteState(informedState)).toBe(true);
    expect(canPersistDigitalAthleteState(unavailableState)).toBe(false);
  });
});
