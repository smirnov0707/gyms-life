import { z } from "zod";
import { DigitalAthleteStateSchema, type DigitalAthleteState } from "./digital-athlete.schema";
import { DIGITAL_ATHLETE_CALCULATION_VERSION } from "./digital-athlete.service";
import { mapDigitalAthleteStateToTwinSnapshot } from "./digital-twin.mapper";

export const TWIN_TREND_LIMIT = 60;
export const TWIN_TREND_MIN_POINTS = 4;
export const TWIN_TREND_MIN_SPAN_HOURS = 72;

export const TWIN_TREND_METRIC_KEYS = [
  "sessionsLast7Days",
  "totalVolumeLast28Days",
  "readiness",
  "sleepHours",
  "weightKg",
  "calories",
  "proteinG",
] as const;
export type TwinTrendMetricKey = (typeof TWIN_TREND_METRIC_KEYS)[number];
export type TwinTrendRegionMetricKey = "recoveryPct" | "volumeKg";

const SnapshotRowSchema = z
  .object({
    id: z.string().uuid(),
    schema_version: z.string().min(1).max(40),
    calculation_version: z.string().min(1).max(80),
    computed_at: z.string().datetime({ offset: true }),
    state: z.unknown(),
  })
  .strict();

export type TwinTrendMetrics = {
  sessionsLast7Days: number;
  totalVolumeLast28Days: number;
  readiness: number | null;
  sleepHours: number | null;
  weightKg: number | null;
  calories: number | null;
  proteinG: number | null;
};

export type TwinTrendRegionPoint = {
  region: string;
  recoveryPct: number | null;
  volumeKg: number | null;
};

export type TwinTrendPoint = {
  id: string;
  computedAt: string;
  schemaVersion: string;
  calculationVersion: string;
  metrics: TwinTrendMetrics;
  regions: TwinTrendRegionPoint[];
};

export type TwinTrendHistory = {
  points: TwinTrendPoint[];
  omittedCount: number;
  incompatibleCount: number;
  hasMore: boolean;
  limit: number;
};

export type TwinTrendSample = {
  snapshotId: string;
  computedAt: string;
  value: number;
};

export type TwinTrendAvailability = "available" | "insufficient_points" | "insufficient_span";
export type TwinTrendDirection = "higher" | "lower" | "unchanged";

export type TwinTrendSeries = {
  availability: TwinTrendAvailability;
  samples: TwinTrendSample[];
  pointCount: number;
  spanHours: number;
  earliestValue: number | null;
  latestValue: number | null;
  netChange: number | null;
  minValue: number | null;
  maxValue: number | null;
  direction: TwinTrendDirection | null;
};

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function metricsFor(state: DigitalAthleteState): TwinTrendMetrics {
  return {
    sessionsLast7Days: state.training.sessionsLast7Days,
    totalVolumeLast28Days: state.training.totalVolumeLast28Days,
    readiness: state.recovery.latestReadinessScore,
    sleepHours: state.recovery.averageSleepHoursLast7Days,
    weightKg: state.body.latestWeightKg,
    calories: state.nutrition.averageCaloriesOnLoggedDays,
    proteinG: state.nutrition.averageProteinGOnLoggedDays,
  };
}

function pointFor(value: unknown): "omitted" | "incompatible" | TwinTrendPoint {
  const parsedRow = SnapshotRowSchema.safeParse(value);
  if (!parsedRow.success) return "omitted";
  const row = parsedRow.data;
  const parsedState = DigitalAthleteStateSchema.safeParse(row.state);
  if (
    row.schema_version !== "1.7" ||
    row.calculation_version !== DIGITAL_ATHLETE_CALCULATION_VERSION ||
    !parsedState.success
  ) {
    return "incompatible";
  }

  const state = parsedState.data;
  const twin = mapDigitalAthleteStateToTwinSnapshot(state, new Date(row.computed_at));
  return {
    id: row.id,
    computedAt: row.computed_at,
    schemaVersion: row.schema_version,
    calculationVersion: row.calculation_version,
    metrics: metricsFor(state),
    regions: twin.regions.map((region) => ({
      region: region.region,
      recoveryPct:
        region.provenance === "calculated" &&
        region.recoveryPct !== null &&
        Number.isFinite(region.recoveryPct)
          ? region.recoveryPct
          : null,
      volumeKg:
        region.provenance === "calculated" &&
        region.volumeKg !== null &&
        Number.isFinite(region.volumeKg)
          ? region.volumeKg
          : null,
    })),
  };
}

/**
 * Compact renderer-safe trend projection. Raw DigitalAthleteState never leaves
 * the server. Only snapshots produced by the currently supported model/schema
 * become trend points; older versions are counted, never reinterpreted.
 */
export function buildTwinTrendHistory(value: unknown): TwinTrendHistory {
  const rows = z
    .array(z.unknown())
    .max(TWIN_TREND_LIMIT + 1)
    .parse(value);
  let omittedCount = 0;
  let incompatibleCount = 0;
  const points: TwinTrendPoint[] = [];

  for (const row of rows.slice(0, TWIN_TREND_LIMIT)) {
    const point = pointFor(row);
    if (point === "omitted") omittedCount += 1;
    else if (point === "incompatible") incompatibleCount += 1;
    else points.push(point);
  }

  points.sort((left, right) => {
    const byTime = Date.parse(left.computedAt) - Date.parse(right.computedAt);
    if (byTime !== 0) return byTime;
    return left.id === right.id ? 0 : left.id < right.id ? -1 : 1;
  });

  return {
    points,
    omittedCount,
    incompatibleCount,
    hasMore: rows.length > TWIN_TREND_LIMIT,
    limit: TWIN_TREND_LIMIT,
  };
}

function summarize(samples: TwinTrendSample[]): TwinTrendSeries {
  const ordered = [...samples].sort((left, right) => {
    const byTime = Date.parse(left.computedAt) - Date.parse(right.computedAt);
    if (byTime !== 0) return byTime;
    return left.snapshotId === right.snapshotId ? 0 : left.snapshotId < right.snapshotId ? -1 : 1;
  });
  const pointCount = ordered.length;
  const spanHours =
    pointCount >= 2
      ? Math.max(
          0,
          (Date.parse(ordered[pointCount - 1]!.computedAt) - Date.parse(ordered[0]!.computedAt)) /
            3_600_000,
        )
      : 0;
  const earliestValue = ordered[0]?.value ?? null;
  const latestValue = ordered[pointCount - 1]?.value ?? null;
  const values = ordered.map((sample) => sample.value);
  const minValue = values.length > 0 ? Math.min(...values) : null;
  const maxValue = values.length > 0 ? Math.max(...values) : null;
  const netChange =
    earliestValue !== null && latestValue !== null ? round(latestValue - earliestValue) : null;
  const availability: TwinTrendAvailability =
    pointCount < TWIN_TREND_MIN_POINTS
      ? "insufficient_points"
      : spanHours < TWIN_TREND_MIN_SPAN_HOURS
        ? "insufficient_span"
        : "available";
  const direction: TwinTrendDirection | null =
    availability !== "available" || netChange === null
      ? null
      : netChange > 0
        ? "higher"
        : netChange < 0
          ? "lower"
          : "unchanged";

  return {
    availability,
    samples: ordered,
    pointCount,
    spanHours: round(spanHours),
    earliestValue,
    latestValue,
    netChange,
    minValue,
    maxValue,
    direction,
  };
}

/**
 * Describes a stored numeric series only. "available" means enough temporal
 * coverage to show an observed direction; it is not statistical significance,
 * improvement, decline, adaptation or causation.
 */
export function buildTwinMetricTrend(
  history: TwinTrendHistory,
  metric: TwinTrendMetricKey,
): TwinTrendSeries {
  return summarize(
    history.points.flatMap((point) => {
      const value = point.metrics[metric];
      return value === null || !Number.isFinite(value)
        ? []
        : [{ snapshotId: point.id, computedAt: point.computedAt, value }];
    }),
  );
}

export function buildTwinRegionTrend(
  history: TwinTrendHistory,
  region: string,
  metric: TwinTrendRegionMetricKey,
): TwinTrendSeries {
  return summarize(
    history.points.flatMap((point) => {
      const value =
        point.regions.find((candidate) => candidate.region === region)?.[metric] ?? null;
      return value === null || !Number.isFinite(value)
        ? []
        : [{ snapshotId: point.id, computedAt: point.computedAt, value }];
    }),
  );
}
