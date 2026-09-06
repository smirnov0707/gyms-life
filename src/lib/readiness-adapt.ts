/** Readiness adjustment: the calculation is shared with the server, which owns the value. */
export { adaptSets, loadModifierFor } from "./readiness.engine";

/**
 * Tells the open screens that today's readiness has changed, so anything
 * showing a decision derived from it re-reads the server.
 *
 * This used to also write the modifier to `gymslife_adapt_<day>` in local
 * storage. Nothing ever read it back — `getAppliedAdaptation` and
 * `clearAdaptation` had no callers — while the value it duplicated,
 * `daily_checkins.load_modifier`, is written by the same request that
 * produced it and is what every consumer actually reads. A per-day key that
 * was written on every check-in, read by nothing and never removed is not a
 * cache; it is a second copy of a fact with no way to notice it drifting.
 */
export function notifyAdaptationChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("gymslife:adaptation"));
}

/**
 * Removes the per-day keys the old client-side copy left behind. Date-suffixed
 * and never cleaned up, they accumulate one per check-in for as long as a
 * device is used.
 */
export function purgeLegacyAdaptationKeys(): void {
  if (typeof window === "undefined") return;
  try {
    const stale = Object.keys(window.localStorage).filter((key) =>
      key.startsWith("gymslife_adapt_"),
    );
    for (const key of stale) window.localStorage.removeItem(key);
  } catch {
    /* storage unavailable; nothing to clean */
  }
}

/** Suggested load adjusted for fatigue, rounded to 0.5 kg. */
export function adaptWeight(weightKg: number, modifier: number): number {
  return Math.round(weightKg * modifier * 2) / 2;
}
