/**
 * When a set was actually performed, as opposed to when its row was written.
 *
 * These are the same instant online and can be many hours apart offline: a
 * set logged in a basement gym at 19:00 reaches the server when signal comes
 * back, sometimes the next morning. The Twin's recovery model is a decay
 * curve over elapsed time, so taking the insert time as the training time
 * reports muscles as far more fatigued than they are, and dates the session
 * to the wrong day.
 *
 * The client is the only party that knows the real instant, so it sends it —
 * which means it cannot be trusted unconditionally. A forward-dated set would
 * park fatigue in the future; a far-backdated one would erase it. The bounds
 * below are the smallest that keep both impossible while leaving every honest
 * offline case intact.
 */

/** Tolerated clock skew ahead of the server before a timestamp is refused. */
export const PERFORMED_AT_FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * How far back a client may date a set. Longer than any plausible offline
 * gap, short enough that a set cannot be hidden behind the Twin's evidence
 * window on arrival.
 */
export const PERFORMED_AT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Resolves the instant to record for a set.
 *
 * Falls back to `now` whenever the client says nothing or says something
 * unusable — an absent or malformed value is not evidence of anything, and
 * the arrival time is the best honest answer left. A value inside the bounds
 * is taken as given; one outside them is clamped to the nearest bound rather
 * than dropped, because the set itself still happened.
 */
export function resolvePerformedAt(clientIso: string | null | undefined, now: Date): Date {
  if (clientIso === null || clientIso === undefined) return now;

  const parsed = new Date(clientIso);
  if (Number.isNaN(parsed.getTime())) return now;

  const nowMs = now.getTime();
  if (parsed.getTime() > nowMs + PERFORMED_AT_FUTURE_TOLERANCE_MS) return now;
  if (parsed.getTime() < nowMs - PERFORMED_AT_MAX_AGE_MS) {
    return new Date(nowMs - PERFORMED_AT_MAX_AGE_MS);
  }
  return parsed;
}
