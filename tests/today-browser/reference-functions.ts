import { TwinSnapshotSchema } from "@/lib/digital-twin.schema";
import {
  KNOWN_MUSCLE_GROUPS,
  MUSCLE_RECOVERY_FRESH_THRESHOLD,
  MUSCLE_RECOVERY_MODERATE_THRESHOLD,
} from "@/lib/muscle-load.schema";
import { buildTodaysTargets } from "@/lib/todays-targets.engine";
import { LabOverviewSchema } from "@/lib/lab.schema";
import { TodayDecisionSchema } from "@/lib/today-decision.schema";
import { DeterministicPerformanceForecastSchema } from "@/lib/forecast.schema";
import { DailyBriefSchema } from "virtual:fixture-brief-schema";
import * as legacy from "./functions-stub";

/** Entirely synthetic, schema-checked records. Never a live-user screenshot. */
const scenario = () => new URLSearchParams(window.location.search).get("scenario");
const isReference = () => scenario() === "reference";
function assertReadable() {
  if (scenario() === "failure") throw new Error("Synthetic source read failure");
}
const when = "2026-09-08T06:00:00.000Z";
const id = "00000000-0000-4000-8000-000000000001";

export async function getLiveSignals() {
  assertReadable();
  if (!isReference()) return legacy.getLiveSignals();
  const readings = {
    sleep: 7.4,
    hrv: 68,
    restingHr: 52,
    steps: 8342,
    activeKcal: 563,
    weight: 78.6,
    bodyFat: 14.7,
  };
  return Object.entries(readings).map(([id, value]) => ({
    id,
    state: "measured",
    value,
    recordedOn: "2026-09-08",
    ageDays: 0,
    delta: id === "weight" ? -0.3 : null,
    source: id === "weight" || id === "bodyFat" ? "manual" : "apple_health",
    history: [0, 1, 2, 3, 4, 5, 6].map((offset) => ({
      day: `2026-09-${String(offset + 2).padStart(2, "0")}`,
      value: value * [1.03, 0.94, 1.01, 0.98, 1.04, 0.96, 1][offset],
    })),
  }));
}
export async function getTwinSnapshot() {
  if (scenario() === "failure")
    return { ...(await legacy.getTwinSnapshot()), dataAvailable: false, regions: [] };
  if (!isReference()) return legacy.getTwinSnapshot();
  // Authored visual coverage, not physiology inferred from these sample hours.
  // The canonical source has "legs"; it does not claim separate quad evidence.
  const readings: Record<
    (typeof KNOWN_MUSCLE_GROUPS)[number],
    {
      recoveryPct: number;
      volumeKg: number;
      lastTrainedHoursAgo: number;
    }
  > = {
    chest: { recoveryPct: 86, volumeKg: 4200, lastTrainedHoursAgo: 72 },
    shoulders: { recoveryPct: 43, volumeKg: 1800, lastTrainedHoursAgo: 18 },
    legs: { recoveryPct: 66, volumeKg: 7200, lastTrainedHoursAgo: 42 },
    back: { recoveryPct: 72, volumeKg: 5100, lastTrainedHoursAgo: 48 },
    arms: { recoveryPct: 74, volumeKg: 1600, lastTrainedHoursAgo: 48 },
    glutes: { recoveryPct: 68, volumeKg: 3600, lastTrainedHoursAgo: 42 },
    core: { recoveryPct: 76, volumeKg: 900, lastTrainedHoursAgo: 54 },
    abs: { recoveryPct: 75, volumeKg: 600, lastTrainedHoursAgo: 54 },
    fullbody: { recoveryPct: 70, volumeKg: 2400, lastTrainedHoursAgo: 48 },
    cardio: { recoveryPct: 78, volumeKg: 0, lastTrainedHoursAgo: 48 },
    mobility: { recoveryPct: 78, volumeKg: 0, lastTrainedHoursAgo: 48 },
  };
  return TwinSnapshotSchema.parse({
    calculationVersion: "SYNTHETIC-REFERENCE-NOT-USER-DATA",
    bodyVariant: "male",
    computedAt: when,
    evidenceWindowDays: 14,
    dataAvailable: true,
    regions: KNOWN_MUSCLE_GROUPS.map((region) => {
      const reading = readings[region];
      return {
        region,
        provenance: "calculated",
        ...reading,
        recoveryBand:
          reading.recoveryPct >= MUSCLE_RECOVERY_FRESH_THRESHOLD
            ? "fresh"
            : reading.recoveryPct >= MUSCLE_RECOVERY_MODERATE_THRESHOLD
              ? "moderate"
              : "fatigued",
      };
    }),
  });
}
export async function getLabOverview() {
  assertReadable();
  return LabOverviewSchema.parse({
    hypotheses: isReference()
      ? [
          {
            id: "training_response_low_feeling",
            domain: "training_response",
            status: "monitoring",
            statementKey: "athlete.hypothesis.trainingResponse.repeatedLowFeeling",
            evidence: [
              { key: "rated_sessions", value: 4, unit: "sessions", source: "user_reported" },
            ],
            evidenceCount: 4,
            minimumEvidenceCount: 6,
            canInfluenceDecision: false,
          },
        ]
      : [],
    hypothesisHistory: [],
    decisions: isReference()
      ? [
          {
            id,
            decisionOn: "2026-09-07",
            action: "train_as_planned",
            basis: "current_checkin",
            status: "completed",
            evidence: [
              { key: "today_readiness", value: "72", sourceClass: "user_reported", position: 0 },
            ],
            outcome: "completed",
            createdAt: when,
          },
        ]
      : [],
    decisionAccuracy: {
      totalProposed: isReference() ? 1 : 0,
      totalAnswered: isReference() ? 1 : 0,
      totalFitting: isReference() ? 1 : 0,
      overallFitRate: null,
      minimumAnswered: 3,
      byBasis: [],
    },
    predictionCalibration: {
      target: "workout_completion",
      maturity: "shadow",
      totalCaptured: 0,
      totalEvaluated: 0,
      totalPending: 0,
      minimumEvaluated: 8,
      models: [],
    },
    dataGaps: isReference()
      ? []
      : [
          "no_completed_workouts_28d",
          "no_recovery_checkins_7d",
          "no_body_measurements_30d",
          "no_nutrition_logs_14d",
        ],
    unreadable: [],
  });
}
export async function getTodayDecision() {
  assertReadable();
  if (!isReference()) return null;
  return TodayDecisionSchema.parse({
    id,
    snapshotId: "00000000-0000-4000-8000-000000000002",
    engineVersion: "1.9",
    decisionOn: "2026-09-08",
    action: "train_as_planned",
    alternatives: ["recover"],
    basis: "current_checkin",
    safetyConstraints: [],
    status: "active",
    evidence: [{ key: "today_readiness", value: "72", sourceClass: "user_reported", position: 0 }],
    createdAt: when,
  });
}
export async function getOvernightWork() {
  if (scenario() === "failure") return { state: "unreadable" as const };
  return isReference()
    ? { state: "ran" as const, runKey: "2026-09-08", at: when, nightsAgo: 0 }
    : { state: "never" as const };
}
export async function forecastProgress() {
  assertReadable();
  return DeterministicPerformanceForecastSchema.parse(
    isReference()
      ? {
          status: "ready",
          forecastVersion: "1.0",
          sourceWindowDays: 120,
          lifts: [
            {
              exerciseSlug: "bench-press",
              exerciseName: "Bench press",
              currentEstimated1RMKg: 92,
              projected4WeeksEstimated1RMKg: 94.4,
              projected12WeeksEstimated1RMKg: 97.5,
              trend: "rising",
              evidenceStrength: "moderate",
              evidence: {
                sessionCount: 12,
                weeksTracked: 6,
                spanDays: 42,
                averageRpe: 7.5,
                observedWeeklyChangeKg: 1.2,
              },
            },
          ],
        }
      : {
          status: "learning",
          forecastVersion: "1.0",
          sourceWindowDays: 120,
          eligibleLiftCount: 0,
          minimumSessionCount: 4,
          minimumSpanDays: 21,
          lifts: [],
        },
  );
}
export async function getTodaysWorkout() {
  assertReadable();
  return legacy.getTodaysWorkout();
}
export async function getTodaysTargets() {
  assertReadable();
  if (!isReference()) return { status: "rest" as const };
  const workout = await legacy.getTodaysWorkout();
  return buildTodaysTargets({
    session: workout.status === "READY" ? workout.workout : null,
    sessionReadable: true,
    muscleGroupBySlug: new Map([
      ["bench-press", "chest"],
      ["incline-db-press", "chest"],
      ["pull-up", "back"],
      ["chest-supported-row", "back"],
      ["lateral-raise", "shoulders"],
    ]),
  });
}
export async function getTrainingLoad() {
  assertReadable();
  return legacy.getTrainingLoad();
}
export async function getLastSessionEffect() {
  assertReadable();
  return isReference() ? legacy.getLastSessionEffect() : { status: "none" as const };
}
export async function getSleepNight() {
  assertReadable();
  return legacy.getSleepNight();
}
export async function getEvidenceReport() {
  assertReadable();
  return legacy.getEvidenceReport();
}
export async function getBodyComposition() {
  assertReadable();
  return isReference() ? legacy.getBodyComposition() : { status: "none" as const };
}
export async function getWorkoutHistory() {
  assertReadable();
  return { sessions: [] };
}

export async function getDailyBrief() {
  assertReadable();
  return DailyBriefSchema.parse(
    isReference()
      ? {
          headline: "A steady day to build on",
          summary:
            "Your check-in is 72 and last night's sleep is 7.4 hours. Keep the recorded plan in view and review the shoulder region's calculated fatigue before your session.",
          focus: "Consistency",
          signals: [
            {
              label: "Readiness",
              value: "72",
              note: "Today's synthetic check-in",
              tone: "neutral",
            },
            { label: "Sleep", value: "7.4 h", note: "Recorded synthetic night", tone: "neutral" },
          ],
          actions: [
            {
              title: "Review your day",
              reason: "Training entry follows the current deterministic decision.",
              evidence: "Readiness check-in: 72",
              route: "/app",
              cta: "Review Today",
              priority: "medium",
            },
          ],
          watchouts: [
            "Shoulder recovery is a calculated estimate, not a physiological measurement.",
          ],
          gaps: [],
          streakDays: 0,
          readiness: 72,
        }
      : {
          headline: "Start with your first check-in",
          summary:
            "There is no recorded readiness or health history in this empty fixture. Log your current state to begin building useful evidence.",
          focus: "Gather evidence",
          signals: [],
          actions: [],
          watchouts: [],
          gaps: ["No recorded check-in or health readings"],
          streakDays: 0,
          readiness: null,
        },
  );
}
