import { z } from "zod";
import { DigitalAthleteStateSchema, type DigitalAthleteState } from "./digital-athlete.schema";
import { DIGITAL_ATHLETE_CALCULATION_VERSION } from "./digital-athlete.service";
import { mapDigitalAthleteStateToTwinSnapshot } from "./digital-twin.mapper";
import type { TwinSnapshot } from "./digital-twin.schema";

export const TWIN_REWIND_LIMIT = 12;

const SnapshotRowSchema = z
  .object({
    id: z.string().uuid(),
    schema_version: z.string().min(1).max(40),
    calculation_version: z.string().min(1).max(80),
    computed_at: z.string().datetime({ offset: true }),
    source_window_start: z.string().datetime({ offset: true }).nullable(),
    source_window_end: z.string().datetime({ offset: true }).nullable(),
    state: z.unknown(),
  })
  .strict();

export type TwinRewindMetrics = {
  sessionsLast7Days: number;
  totalVolumeLast28Days: number;
  readiness: number | null;
  sleepHours: number | null;
  weightKg: number | null;
  calories: number | null;
  proteinG: number | null;
  evidenceCount: number;
};

export type TwinRewindPoint = {
  id: string;
  computedAt: string;
  calculationVersion: string;
  schemaVersion: string;
  sourceWindowStart: string | null;
  sourceWindowEnd: string | null;
  compatible: boolean;
  dataQualityLevel: DigitalAthleteState["dataQuality"]["level"] | null;
  metrics: TwinRewindMetrics | null;
  twin: TwinSnapshot | null;
};

export type TwinRewindHistory = {
  points: TwinRewindPoint[];
  omittedCount: number;
  incompatibleCount: number;
  hasMore: boolean;
  limit: number;
};

export type TwinRewindDelta = {
  sessionsLast7Days: number | null;
  totalVolumeLast28Days: number | null;
  readiness: number | null;
  sleepHours: number | null;
  weightKg: number | null;
  calories: number | null;
  proteinG: number | null;
  evidenceCount: number | null;
};

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function metricsFor(state: DigitalAthleteState): TwinRewindMetrics {
  return {
    sessionsLast7Days: state.training.sessionsLast7Days,
    totalVolumeLast28Days: state.training.totalVolumeLast28Days,
    readiness: state.recovery.latestReadinessScore,
    sleepHours: state.recovery.averageSleepHoursLast7Days,
    weightKg: state.body.latestWeightKg,
    calories: state.nutrition.averageCaloriesOnLoggedDays,
    proteinG: state.nutrition.averageProteinGOnLoggedDays,
    evidenceCount: state.dataQuality.evidenceCount,
  };
}

function pointFor(value: unknown): TwinRewindPoint | null {
  const parsedRow = SnapshotRowSchema.safeParse(value);
  if (!parsedRow.success) return null;
  const row = parsedRow.data;
  const parsedState = DigitalAthleteStateSchema.safeParse(row.state);
  const compatible =
    row.schema_version === "1.7" &&
    row.calculation_version === DIGITAL_ATHLETE_CALCULATION_VERSION &&
    parsedState.success;

  if (!compatible) {
    return {
      id: row.id,
      computedAt: row.computed_at,
      calculationVersion: row.calculation_version,
      schemaVersion: row.schema_version,
      sourceWindowStart: row.source_window_start,
      sourceWindowEnd: row.source_window_end,
      compatible: false,
      dataQualityLevel: null,
      metrics: null,
      twin: null,
    };
  }

  const state = parsedState.data;
  return {
    id: row.id,
    computedAt: row.computed_at,
    calculationVersion: row.calculation_version,
    schemaVersion: row.schema_version,
    sourceWindowStart: row.source_window_start,
    sourceWindowEnd: row.source_window_end,
    compatible: true,
    dataQualityLevel: state.dataQuality.level,
    metrics: metricsFor(state),
    twin: mapDigitalAthleteStateToTwinSnapshot(state, new Date(row.computed_at)),
  };
}

/**
 * Converts immutable athlete-state rows into a bounded renderer projection.
 * Raw DigitalAthleteState, context and source summaries never leave the server.
 */
export function buildTwinRewindHistory(value: unknown): TwinRewindHistory {
  const rows = z
    .array(z.unknown())
    .max(TWIN_REWIND_LIMIT + 1)
    .parse(value);
  let omittedCount = 0;
  const points: TwinRewindPoint[] = [];

  for (const row of rows.slice(0, TWIN_REWIND_LIMIT)) {
    const point = pointFor(row);
    if (point === null) omittedCount += 1;
    else points.push(point);
  }

  points.sort((left, right) => {
    const byTime = Date.parse(right.computedAt) - Date.parse(left.computedAt);
    if (byTime !== 0) return byTime;
    return left.id === right.id ? 0 : left.id < right.id ? 1 : -1;
  });

  return {
    points,
    omittedCount,
    incompatibleCount: points.filter((point) => !point.compatible).length,
    hasMore: rows.length > TWIN_REWIND_LIMIT,
    limit: TWIN_REWIND_LIMIT,
  };
}

function delta(older: number | null, newer: number | null, digits = 1): number | null {
  if (older === null || newer === null) return null;
  return round(newer - older, digits);
}

/**
 * Factual arithmetic only. A rolling-window delta is not labelled improvement,
 * decline, causation or physiological adaptation.
 */
export function compareTwinRewindPoints(
  older: TwinRewindPoint | null | undefined,
  newer: TwinRewindPoint | null | undefined,
): TwinRewindDelta | null {
  if (!older?.compatible || !newer?.compatible || !older.metrics || !newer.metrics) return null;
  if (
    older.calculationVersion !== newer.calculationVersion ||
    older.schemaVersion !== newer.schemaVersion
  ) {
    return null;
  }

  return {
    sessionsLast7Days: delta(older.metrics.sessionsLast7Days, newer.metrics.sessionsLast7Days, 0),
    totalVolumeLast28Days: delta(
      older.metrics.totalVolumeLast28Days,
      newer.metrics.totalVolumeLast28Days,
    ),
    readiness: delta(older.metrics.readiness, newer.metrics.readiness),
    sleepHours: delta(older.metrics.sleepHours, newer.metrics.sleepHours),
    weightKg: delta(older.metrics.weightKg, newer.metrics.weightKg),
    calories: delta(older.metrics.calories, newer.metrics.calories),
    proteinG: delta(older.metrics.proteinG, newer.metrics.proteinG),
    evidenceCount: delta(older.metrics.evidenceCount, newer.metrics.evidenceCount, 0),
  };
}
