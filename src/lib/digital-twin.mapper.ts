import type { DigitalAthleteState } from "./digital-athlete.schema";
import {
  DIGITAL_ATHLETE_CALCULATION_VERSION,
  MUSCLE_LOAD_LOOKBACK_DAYS,
} from "./digital-athlete.service";
import {
  TwinRegionStateSchema,
  TwinSnapshotSchema,
  type TwinRegionRecoveryBand,
  type TwinRegionState,
  type TwinSnapshot,
} from "./digital-twin.schema";
import {
  KNOWN_MUSCLE_GROUPS,
  MUSCLE_RECOVERY_FRESH_THRESHOLD,
  MUSCLE_RECOVERY_MODERATE_THRESHOLD,
  type MuscleGroupLoad,
} from "./muscle-load.schema";

function recoveryBandFor(recoveryPct: number): TwinRegionRecoveryBand {
  if (recoveryPct >= MUSCLE_RECOVERY_FRESH_THRESHOLD) return "fresh";
  if (recoveryPct >= MUSCLE_RECOVERY_MODERATE_THRESHOLD) return "moderate";
  return "fatigued";
}

function calculatedRegion(load: MuscleGroupLoad): TwinRegionState {
  return TwinRegionStateSchema.parse({
    region: load.muscleGroup,
    provenance: "calculated",
    recoveryPct: load.recoveryPct,
    recoveryBand: recoveryBandFor(load.recoveryPct),
    volumeKg: load.volumeKg,
    lastTrainedHoursAgo: load.lastTrainedHoursAgo,
  });
}

function unknownRegion(region: string): TwinRegionState {
  return TwinRegionStateSchema.parse({
    region,
    provenance: "unknown",
    recoveryPct: null,
    recoveryBand: "unknown",
    volumeKg: null,
    lastTrainedHoursAgo: null,
  });
}

/**
 * Maps the canonical Digital Athlete state to a Twin-renderer-ready
 * snapshot. Pure and deterministic: no rendering, no new queries, no new
 * intelligence — every value already exists on `state.muscleLoad`.
 *
 * One entry per region with real evidence, plus an explicit "unknown"
 * placeholder for every reference region without any. A region is never
 * silently omitted or defaulted to "fully recovered" just because nothing
 * was logged for it recently — omission and "no evidence" are different
 * facts and must stay visibly different.
 */
export function mapDigitalAthleteStateToTwinSnapshot(
  state: DigitalAthleteState,
  computedAt: Date,
): TwinSnapshot {
  const dataAvailable = !state.dataGaps.includes("muscle_load_data_unavailable");
  const calculatedRegions = state.muscleLoad.map((load) =>
    dataAvailable ? calculatedRegion(load) : unknownRegion(load.muscleGroup),
  );
  const calculatedRegionNames = new Set(calculatedRegions.map((region) => region.region));
  const placeholderRegions = KNOWN_MUSCLE_GROUPS.filter(
    (group) => !calculatedRegionNames.has(group),
  ).map(unknownRegion);

  return TwinSnapshotSchema.parse({
    calculationVersion: DIGITAL_ATHLETE_CALCULATION_VERSION,
    computedAt: computedAt.toISOString(),
    evidenceWindowDays: MUSCLE_LOAD_LOOKBACK_DAYS,
    dataAvailable,
    regions: [...calculatedRegions, ...placeholderRegions],
  });
}
