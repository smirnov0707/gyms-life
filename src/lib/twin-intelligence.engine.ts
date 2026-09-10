import type { DigitalAthleteState } from "./digital-athlete.schema";
import {
  TwinIntelligenceSchema,
  type TwinIntelligence,
  type TwinIntelligenceRegion,
} from "./twin-intelligence.schema";

function regionAttention(recoveryPct: number | null, volumeKg: number | null) {
  if (recoveryPct === null) return "unknown" as const;
  if (recoveryPct < 55) return "recovery_attention" as const;
  if ((volumeKg ?? 0) > 0 && recoveryPct < 80) return "recent_load" as const;
  return "balanced" as const;
}

function focusRegions(state: DigitalAthleteState): TwinIntelligenceRegion[] {
  return state.muscleLoad
    .map((region) => ({
      region: region.muscleGroup,
      recoveryPct: region.recoveryPct,
      volumeKg: region.volumeKg,
      lastTrainedHoursAgo: region.lastTrainedHoursAgo,
      attention: regionAttention(region.recoveryPct, region.volumeKg),
    }))
    .sort((left, right) => {
      const leftPriority =
        left.attention === "recovery_attention" ? 0 : left.attention === "recent_load" ? 1 : 2;
      const rightPriority =
        right.attention === "recovery_attention" ? 0 : right.attention === "recent_load" ? 1 : 2;
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      return (left.recoveryPct ?? 101) - (right.recoveryPct ?? 101);
    })
    .slice(0, 6);
}
function intelligenceMode(state: DigitalAthleteState): TwinIntelligence["mode"] {
  if (state.dataQuality.level === "cold_start") return "insufficient_evidence";
  if (state.currentContext.hasSafetyConstraint) return "context_attention";
  const readiness = state.recovery.latestReadinessScore;
  const averageReadiness = state.recovery.averageReadinessLast7Days;
  const sleep = state.recovery.averageSleepHoursLast7Days;
  if (
    (readiness !== null && readiness < 55) ||
    (averageReadiness !== null && averageReadiness < 55) ||
    (sleep !== null && sleep < 6)
  )
    return "recovery_attention";
  if (
    readiness !== null &&
    readiness >= 70 &&
    averageReadiness !== null &&
    averageReadiness >= 65 &&
    sleep !== null &&
    sleep >= 6.5
  )
    return "training_ready";
  return "balanced";
}

export function buildTwinIntelligence(
  state: DigitalAthleteState,
  now = new Date(),
): TwinIntelligence {
  const unknownSignals: string[] = [];
  if (state.recovery.latestReadinessScore === null) unknownSignals.push("readiness");
  if (state.recovery.averageSleepHoursLast7Days === null) unknownSignals.push("sleep");
  if (state.body.latestWeightKg === null) unknownSignals.push("weight");
  if (state.body.latestBodyFatPercent === null) unknownSignals.push("body_fat");
  if (!state.muscleLoad.length) unknownSignals.push("muscle_load");

  const knownFacts = 5 - unknownSignals.length;
  return TwinIntelligenceSchema.parse({
    version: "1.0",
    computedAt: now.toISOString(),
    mode: intelligenceMode(state),
    dataQuality: state.dataQuality.level,
    readiness: state.recovery.latestReadinessScore,
    averageReadiness7d: state.recovery.averageReadinessLast7Days,
    averageSleepHours7d: state.recovery.averageSleepHoursLast7Days,
    sessions7d: state.training.sessionsLast7Days,
    sessions28d: state.training.sessionsLast28Days,
    trainingVolume28d: state.training.totalVolumeLast28Days,
    weightKg: state.body.latestWeightKg,
    weightChangeKg30d: state.body.weightChangeKgLast30Days,
    bodyFatPercent: state.body.latestBodyFatPercent,
    hasSafetyConstraint: state.currentContext.hasSafetyConstraint,
    focusRegions: focusRegions(state),
    knownFacts,
    unknownSignals,
  });
}
