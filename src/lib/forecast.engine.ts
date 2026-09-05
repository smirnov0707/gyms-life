import { calculateAverage, calculateEstimated1RM } from "./performance.engine";
import {
  DeterministicLiftForecastSchema,
  DeterministicPerformanceForecastSchema,
  type DeterministicLiftForecast,
  type DeterministicPerformanceForecast,
} from "./forecast.schema";
import type { WorkoutSetLog } from "./workout-set-log.schema";

export const FORECAST_SOURCE_WINDOW_DAYS = 120;
export const FORECAST_MINIMUM_SESSION_COUNT = 4;
export const FORECAST_MINIMUM_SPAN_DAYS = 21;

const DAY_MS = 86_400_000;
const WEEK_MS = DAY_MS * 7;
const MAX_FORECAST_LIFTS = 6;
const RECENT_CURRENT_STRENGTH_DAYS = 42;

type SessionPerformance = {
  sessionId: string;
  exerciseName: string;
  timestamp: number;
  estimated1RMKg: number;
  rpe: number | null;
};

type WeeklyPerformance = {
  timestamp: number;
  estimated1RMKg: number;
};

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundToHalfKilogram(value: number): number {
  return Math.round(value * 2) / 2;
}

function clamp(value: number, lower: number, upper: number): number {
  return Math.min(Math.max(value, lower), upper);
}

function weekStartUtc(timestamp: number): number {
  const date = new Date(timestamp);
  const weekday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - weekday);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}

function linearWeeklySlope(points: readonly WeeklyPerformance[]): number {
  if (points.length < 2) return 0;
  const firstTimestamp = points[0]?.timestamp;
  if (firstTimestamp === undefined) return 0;

  const coordinates = points.map((point) => ({
    x: (point.timestamp - firstTimestamp) / WEEK_MS,
    y: point.estimated1RMKg,
  }));
  const meanX = coordinates.reduce((sum, point) => sum + point.x, 0) / coordinates.length;
  const meanY = coordinates.reduce((sum, point) => sum + point.y, 0) / coordinates.length;
  const denominator = coordinates.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0);
  if (denominator === 0) return 0;

  const numerator = coordinates.reduce(
    (sum, point) => sum + (point.x - meanX) * (point.y - meanY),
    0,
  );
  return numerator / denominator;
}

/**
 * This measures the amount of observed evidence, not a claimed probability
 * that a future outcome will occur. Prediction calibration is a later,
 * separate responsibility once there are enough observed forecasts/outcomes.
 */
function evidenceStrengthFor(sessionCount: number, weeksTracked: number, spanDays: number) {
  if (sessionCount >= 12 && weeksTracked >= 8 && spanDays >= 84) return "high" as const;
  if (sessionCount >= 8 && weeksTracked >= 6 && spanDays >= 56) return "moderate" as const;
  return "low" as const;
}

function trendFor(currentEstimated1RMKg: number, observedWeeklyChangeKg: number) {
  const neutralBandKg = Math.max(currentEstimated1RMKg * 0.0025, 0.25);
  if (observedWeeklyChangeKg >= neutralBandKg) return "rising" as const;
  if (observedWeeklyChangeKg <= -neutralBandKg) return "falling" as const;
  return "flat" as const;
}

/**
 * A forecast uses one best estimated 1RM per completed exercise session.
 * This prevents a high-volume workout or extra warm-up sets from dominating
 * the trend merely because it logged more rows.
 */
function sessionPerformanceFor(
  rows: readonly WorkoutSetLog[],
  now: Date,
): Map<string, SessionPerformance[]> {
  const cutoff = now.getTime() - FORECAST_SOURCE_WINDOW_DAYS * DAY_MS;
  const byExercise = new Map<string, Map<string, SessionPerformance>>();

  for (const row of rows) {
    // Performance over time, so the instant the set happened — not the
    // instant its row was written, which offline sync moves.
    const timestamp = Date.parse(row.performedAt);
    if (!Number.isFinite(timestamp) || timestamp < cutoff || timestamp > now.getTime()) continue;
    // The Epley estimate becomes increasingly unreliable above this range.
    if (!row.done || row.reps === null || row.reps > 30) continue;
    const estimated1RMKg = calculateEstimated1RM(row.weightKg, row.reps);
    if (estimated1RMKg === null) continue;

    const point: SessionPerformance = {
      sessionId: row.sessionId,
      exerciseName: row.exerciseName,
      timestamp,
      estimated1RMKg,
      rpe: row.rpe,
    };
    const sessions = byExercise.get(row.exerciseSlug) ?? new Map<string, SessionPerformance>();
    const current = sessions.get(row.sessionId);
    if (
      current === undefined ||
      point.estimated1RMKg > current.estimated1RMKg ||
      (point.estimated1RMKg === current.estimated1RMKg && point.timestamp > current.timestamp)
    ) {
      sessions.set(row.sessionId, point);
    }
    byExercise.set(row.exerciseSlug, sessions);
  }

  return new Map(
    [...byExercise.entries()].map(([exerciseSlug, sessions]) => [
      exerciseSlug,
      [...sessions.values()].sort((left, right) => left.timestamp - right.timestamp),
    ]),
  );
}

function weeklyPerformanceFor(points: readonly SessionPerformance[]): WeeklyPerformance[] {
  const byWeek = new Map<number, number>();
  for (const point of points) {
    const weekStart = weekStartUtc(point.timestamp);
    const prior = byWeek.get(weekStart) ?? 0;
    if (point.estimated1RMKg > prior) byWeek.set(weekStart, point.estimated1RMKg);
  }
  return [...byWeek.entries()]
    .sort(([left], [right]) => left - right)
    .map(([timestamp, estimated1RMKg]) => ({ timestamp, estimated1RMKg }));
}

function forecastForExercise(
  exerciseSlug: string,
  points: readonly SessionPerformance[],
): DeterministicLiftForecast | null {
  const first = points[0];
  const latest = points.at(-1);
  if (first === undefined || latest === undefined) return null;

  const spanDays = Math.floor((latest.timestamp - first.timestamp) / DAY_MS);
  const weekly = weeklyPerformanceFor(points);
  if (
    points.length < FORECAST_MINIMUM_SESSION_COUNT ||
    spanDays < FORECAST_MINIMUM_SPAN_DAYS ||
    weekly.length < 3
  ) {
    return null;
  }

  const recentCutoff = latest.timestamp - RECENT_CURRENT_STRENGTH_DAYS * DAY_MS;
  const recentPoints = points.filter((point) => point.timestamp >= recentCutoff);
  const currentEstimated1RMKg = Math.max(
    ...(recentPoints.length > 0 ? recentPoints : points).map((point) => point.estimated1RMKg),
  );
  const observedWeeklyChangeKg = linearWeeklySlope(weekly);
  // Forecasts deliberately retain only half of the observed slope and cap its
  // weekly influence. This is an estimate from recorded outcomes, not a load
  // prescription and not a promise of continued progression.
  const dampedWeeklyChangeKg = clamp(
    observedWeeklyChangeKg * 0.5,
    -currentEstimated1RMKg * 0.01,
    currentEstimated1RMKg * 0.015,
  );
  const projected4WeeksEstimated1RMKg = roundToHalfKilogram(
    Math.max(0.5, currentEstimated1RMKg + dampedWeeklyChangeKg * 4),
  );
  // The longer horizon is additionally damped, so its effective continuation
  // is eight rather than twelve weeks of the observed slope.
  const projected12WeeksEstimated1RMKg = roundToHalfKilogram(
    Math.max(0.5, currentEstimated1RMKg + dampedWeeklyChangeKg * 8),
  );
  const averageRpe = calculateAverage(
    points.flatMap((point) => (point.rpe === null ? [] : [point.rpe])),
  );

  return DeterministicLiftForecastSchema.parse({
    exerciseSlug,
    exerciseName: latest.exerciseName,
    currentEstimated1RMKg: roundToOneDecimal(currentEstimated1RMKg),
    projected4WeeksEstimated1RMKg,
    projected12WeeksEstimated1RMKg,
    trend: trendFor(currentEstimated1RMKg, observedWeeklyChangeKg),
    evidenceStrength: evidenceStrengthFor(points.length, weekly.length, spanDays),
    evidence: {
      sessionCount: points.length,
      weeksTracked: weekly.length,
      spanDays,
      averageRpe,
      observedWeeklyChangeKg: roundToOneDecimal(observedWeeklyChangeKg),
    },
  });
}

/**
 * Builds a bounded, deterministic forecast strictly from validated completed
 * set logs. It never selects a working weight or mutates a training plan.
 */
export function buildDeterministicPerformanceForecast(
  rows: readonly WorkoutSetLog[],
  now = new Date(),
): DeterministicPerformanceForecast {
  const byExercise = sessionPerformanceFor(rows, now);
  const lifts = [...byExercise.entries()]
    .flatMap(([exerciseSlug, points]) => {
      const forecast = forecastForExercise(exerciseSlug, points);
      return forecast === null ? [] : [forecast];
    })
    .sort(
      (left, right) =>
        right.evidence.sessionCount - left.evidence.sessionCount ||
        right.evidence.spanDays - left.evidence.spanDays ||
        left.exerciseName.localeCompare(right.exerciseName),
    )
    .slice(0, MAX_FORECAST_LIFTS);

  if (lifts.length === 0) {
    return DeterministicPerformanceForecastSchema.parse({
      status: "learning",
      forecastVersion: "1.0",
      sourceWindowDays: FORECAST_SOURCE_WINDOW_DAYS,
      eligibleLiftCount: byExercise.size,
      minimumSessionCount: FORECAST_MINIMUM_SESSION_COUNT,
      minimumSpanDays: FORECAST_MINIMUM_SPAN_DAYS,
      lifts: [],
    });
  }

  return DeterministicPerformanceForecastSchema.parse({
    status: "ready",
    forecastVersion: "1.0",
    sourceWindowDays: FORECAST_SOURCE_WINDOW_DAYS,
    lifts,
  });
}
