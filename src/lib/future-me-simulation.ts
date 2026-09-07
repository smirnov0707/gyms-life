import type { DeterministicLiftForecast } from "./forecast.schema";

export const FUTURE_ME_HORIZONS = ["30d", "90d", "180d", "1y"] as const;
export type FutureMeHorizon = (typeof FUTURE_ME_HORIZONS)[number];

/**
 * The current deterministic model has validated output only at four and
 * twelve weeks. Longer UI horizons stay selectable so the product can show
 * the boundary honestly; they never extrapolate a made-up value.
 */
export function projectedEstimated1RM(
  lift: DeterministicLiftForecast,
  horizon: FutureMeHorizon,
): number | null {
  if (horizon === "30d") return lift.projected4WeeksEstimated1RMKg;
  if (horizon === "90d") return lift.projected12WeeksEstimated1RMKg;
  return null;
}

export function projectedChangePercent(current: number, projected: number | null): number | null {
  if (
    !Number.isFinite(current) ||
    current <= 0 ||
    projected === null ||
    !Number.isFinite(projected)
  ) {
    return null;
  }
  return Math.round(((projected - current) / current) * 1000) / 10;
}

export function isValidatedFutureMeHorizon(horizon: FutureMeHorizon): boolean {
  return horizon === "30d" || horizon === "90d";
}
