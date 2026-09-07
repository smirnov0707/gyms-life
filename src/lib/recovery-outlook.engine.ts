import { MUSCLE_LOAD_DECAY_TIME_CONSTANT_HOURS } from "./muscle-load.engine";

/**
 * When each region comes back, if nothing else is trained.
 *
 * This is what stands in for the template's "NEXT 7 DAYS OUTLOOK". That panel
 * draws a week of predicted performance against calendar days, and two things
 * make it unbuildable honestly. The plan carries no calendar at all — the
 * scheduler picks the next session from what was finished, deliberately, so
 * "Thursday: chest" would be invented. And the prediction model is validated
 * at four and twelve weeks, not at one day.
 *
 * What can be said is arithmetic rather than prophecy. Fatigue in this system
 * decays exponentially with one time constant, so a region's recovery at any
 * future hour follows from its recovery now with no new assumption:
 *
 *     fatigue(t + h) = fatigue(t) · e^(-h / τ)
 *
 * Every contribution decays at the same rate, so the whole sum scales — the
 * projection needs nothing the athlete cannot already see on the Twin. It is
 * the same calculated estimate, read forward instead of at zero.
 *
 * The one assumption is stated everywhere this is shown: nothing new is
 * trained. Train the region tomorrow and the curve restarts, which is the
 * point of showing it.
 *
 * Pure and total.
 */

/**
 * Where a region is called recovered enough to train again, and where it is
 * called fully back.
 *
 * Deliberate and user-visible, like the decay constant itself: these decide
 * what the athlete is told about their own body, so they are a stated choice
 * rather than a tuning detail.
 */
export const RECOVERY_READY_PCT = 80;
export const RECOVERY_FULL_PCT = 95;

/**
 * How far ahead this will speak, and why it is not a week.
 *
 * The arithmetic runs as far as you like — an exponential reaches any target
 * eventually — but the number's precision outruns its one assumption. "Your
 * chest is back in five days" is exact only if nothing is trained for five
 * days, which is false for anyone following a plan, and stating it to the hour
 * dresses an assumption up as a measurement.
 *
 * Three days is the span the decision actually covers: train it today, wait a
 * day, or leave it for later in the week. Past that the honest answer is that
 * it depends on what gets trained in between, so the panel says so instead of
 * naming an hour.
 */
export const RECOVERY_HORIZON_HOURS = 72;

/** Recovery percentage `hours` from now, if nothing further is trained. */
export function projectRecovery(recoveryPct: number, hours: number): number {
  if (!Number.isFinite(recoveryPct) || !Number.isFinite(hours) || hours < 0) return recoveryPct;
  const fatigue = Math.max(0, Math.min(100, 100 - recoveryPct));
  return 100 - fatigue * Math.exp(-hours / MUSCLE_LOAD_DECAY_TIME_CONSTANT_HOURS);
}

/**
 * Hours until a region reaches `target`, or null when it is further away than
 * the horizon this will speak to.
 *
 * Zero when it is already there — a region at target needs no waiting, and
 * saying "0 hours" is truer than omitting it.
 */
export function hoursToRecovery(recoveryPct: number, target: number): number | null {
  if (!Number.isFinite(recoveryPct) || !Number.isFinite(target)) return null;
  if (recoveryPct >= target) return 0;
  const fatigueNow = 100 - recoveryPct;
  const fatigueTarget = 100 - target;
  // A target of 100 is never reached by an exponential. The thresholds above
  // stay under it for exactly that reason, but the guard stays: a caller
  // asking for full recovery deserves null, not Infinity rendered as a number.
  if (fatigueTarget <= 0 || fatigueNow <= 0) return null;
  const hours = -MUSCLE_LOAD_DECAY_TIME_CONSTANT_HOURS * Math.log(fatigueTarget / fatigueNow);
  if (!Number.isFinite(hours) || hours < 0) return null;
  return hours > RECOVERY_HORIZON_HOURS ? null : Math.round(hours);
}

export type RegionRecoveryOutlook = {
  region: string;
  recoveryPct: number;
  /** Hours until the region is ready to train again; null if beyond the horizon. */
  hoursToReady: number | null;
  /** Hours until the region is fully back; null if beyond the horizon. */
  hoursToFull: number | null;
  /** True when the region is already at or above the ready threshold. */
  readyNow: boolean;
};

export type RecoveryOutlook =
  /** The Twin's own source could not be read. Not a body with nothing to recover. */
  | { status: "unreadable" }
  | {
      status: "projected";
      /** Regions still under the ready threshold, soonest back first. */
      recovering: RegionRecoveryOutlook[];
      /** Regions at or above it, so nothing is waiting on them. */
      readyCount: number;
      /**
       * Regions whose recovery is not calculated at all. Counted rather than
       * dropped: an outlook that silently listed six of nine regions would
       * read as a body three regions smaller than it is.
       */
      unknownCount: number;
      readyPct: number;
      fullPct: number;
      horizonHours: number;
    };

export function buildRecoveryOutlook(input: {
  /** Null when the snapshot could not be read. */
  regions: readonly { region: string; recoveryPct: number | null }[] | null;
  readyPct?: number;
  fullPct?: number;
}): RecoveryOutlook {
  if (input.regions === null) return { status: "unreadable" };
  const readyPct = input.readyPct ?? RECOVERY_READY_PCT;
  const fullPct = input.fullPct ?? RECOVERY_FULL_PCT;

  const recovering: RegionRecoveryOutlook[] = [];
  let readyCount = 0;
  let unknownCount = 0;

  for (const region of input.regions) {
    if (region.recoveryPct === null) {
      unknownCount += 1;
      continue;
    }
    if (region.recoveryPct >= readyPct) {
      readyCount += 1;
      continue;
    }
    recovering.push({
      region: region.region,
      recoveryPct: region.recoveryPct,
      hoursToReady: hoursToRecovery(region.recoveryPct, readyPct),
      hoursToFull: hoursToRecovery(region.recoveryPct, fullPct),
      readyNow: false,
    });
  }

  // Soonest back first. A region past the horizon has a null wait and sorts
  // last, where it belongs: it is the one furthest from being trainable.
  recovering.sort((left, right) => {
    if (left.hoursToReady === right.hoursToReady) return left.region.localeCompare(right.region);
    if (left.hoursToReady === null) return 1;
    if (right.hoursToReady === null) return -1;
    return left.hoursToReady - right.hoursToReady;
  });

  return {
    status: "projected",
    recovering,
    readyCount,
    unknownCount,
    readyPct,
    fullPct,
    horizonHours: RECOVERY_HORIZON_HOURS,
  };
}
