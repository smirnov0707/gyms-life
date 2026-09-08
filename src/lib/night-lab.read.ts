/**
 * What the product may say about the athlete's own overnight work.
 *
 * The ledger records that a run happened. It cannot say whose Twin it
 * recalculated: a run is bounded, so "the Night Lab ran last night" is not
 * "the Night Lab updated you". The per-athlete `twin_recalculated` timeline
 * row is what makes the second sentence sayable, and this is the shape of
 * everything that may be said from it.
 *
 * The states are the ones this codebase uses everywhere else, and the two that
 * look alike are the whole point:
 *
 * `never`      — no overnight run has ever recalculated this athlete. That is
 *                a fact about them, and it is the ordinary state for someone
 *                new, or for someone who has produced nothing since a run last
 *                looked. It is not a claim that anything is broken.
 * `unreadable` — the timeline could not be read. That is a fact about us. The
 *                difference matters more here than almost anywhere, because a
 *                failed read rendered as `never` would tell an athlete whose
 *                Twin is being maintained nightly that nothing has ever
 *                happened.
 *
 * Pure and total.
 */

export type OvernightWork =
  | { readonly state: "unreadable" }
  | { readonly state: "never" }
  | {
      readonly state: "ran";
      /** The run's own period key, `YYYY-MM-DD`, as the ledger names it. */
      readonly runKey: string;
      /** When the run's window closed. */
      readonly at: string;
      /** Whole days between that night and today, 0 when it was last night's. */
      readonly nightsAgo: number;
    };

/** One `twin_recalculated` row, as the timeline stores it. */
export type OvernightRow = {
  readonly occurredAt: string;
  readonly sourceReference: string;
};

const DAY_MS = 86_400_000;

/**
 * The most recent overnight recalculation, from the athlete's own rows.
 *
 * `rows` is null when the read failed and empty when it succeeded and found
 * nothing — the distinction the caller must not collapse, and the reason this
 * takes a nullable list rather than a list.
 */
export function overnightWork(
  rows: readonly OvernightRow[] | null,
  now: Date = new Date(),
): OvernightWork {
  if (rows === null) return { state: "unreadable" };

  let newest: OvernightRow | null = null;
  for (const row of rows) {
    if (!Number.isFinite(Date.parse(row.occurredAt))) continue;
    if (newest === null || row.occurredAt > newest.occurredAt) newest = row;
  }
  if (newest === null) return { state: "never" };

  const at = Date.parse(newest.occurredAt);
  // Floored, so a run eight hours ago is "last night" rather than "today" and
  // one twenty-six hours ago is one night back. A run dated in the future —
  // a clock disagreement, not a lie — reads as the most recent one rather
  // than as a negative number of nights.
  const nightsAgo = Math.max(0, Math.floor((now.getTime() - at) / DAY_MS));

  return {
    state: "ran",
    runKey: newest.sourceReference,
    at: newest.occurredAt,
    nightsAgo,
  };
}
