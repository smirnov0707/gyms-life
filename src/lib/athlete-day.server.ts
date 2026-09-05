import { dayInTimeZone } from "./local-day";
import { loadPersistedProfileTimeZone } from "./user-context.server";

/**
 * Today in the athlete's stored timezone, falling back to UTC.
 *
 * Anything keyed on a calendar day has to use this rather than
 * `new Date().toISOString().slice(0, 10)`. The UTC date is the previous day
 * for every athlete east of Greenwich during their small hours, and
 * `body_metrics` upserts on `(user_id, measured_on)` — so a 01:00 weigh-in
 * in Vilnius does not record a new measurement, it overwrites yesterday's.
 *
 * A missing or unreadable timezone must not cost the measurement itself, so
 * this never throws: an approximate date is worth more than a lost reading.
 */
export async function athleteDay(
  supabase: Parameters<typeof loadPersistedProfileTimeZone>[0],
  userId: string,
): Promise<string> {
  try {
    return dayInTimeZone(new Date(), await loadPersistedProfileTimeZone(supabase, userId));
  } catch {
    return dayInTimeZone(new Date(), "UTC");
  }
}
