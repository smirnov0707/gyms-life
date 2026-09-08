/**
 * The rules a background job runs by, with no database and no clock of its own.
 *
 * Everything in this product until now happened inside a request: somebody
 * opened a screen, and the calculation ran because they were looking. The
 * constitution asks for work that happens while nobody is looking, and it asks
 * four things of that work — idempotent, observable, retry-safe, bounded.
 *
 * Three of the four are decisions, not plumbing, so they live here where they
 * can be tested:
 *
 *   idempotent  — `runKeyFor` names the period, and one run per name per
 *                 period is all the ledger will accept. A scheduler that fires
 *                 twice claims nothing new.
 *   retry-safe  — `claimDecision` says whether a run may start given whatever
 *                 the ledger already holds. A crashed container leaves a row
 *                 marked `running` forever; without a lease that row blocks the
 *                 job for good, and with too short a lease two containers do
 *                 the same work at once.
 *   bounded     — `jobWindow` and `JOB_ITEM_LIMIT` decide how much a single run
 *                 is allowed to touch. A job with no bound is a job that gets
 *                 slower every day until the night it does not finish.
 *
 * The fourth, observability, is a matter of writing down what happened, and
 * that belongs to the ledger rather than to arithmetic.
 *
 * Pure and total.
 */

/** The jobs this system knows how to run. */
export const JOB_NAMES = ["night_lab"] as const;
export type JobName = (typeof JOB_NAMES)[number];

/**
 * How long a run may hold its claim before another may take it over.
 *
 * This is the one number in the file that is a judgement rather than a
 * definition. Too short and a slow night is done twice, in parallel, by two
 * containers writing the same rows. Too long and a job that died at 03:00 is
 * still blocked at 03:00 the next night, which is exactly the failure that
 * leaves the product saying nothing ran for a week.
 *
 * Thirty minutes is comfortably longer than any run this job is bounded to
 * take, and comfortably shorter than the daily period, so a dead run is always
 * reclaimed by the next night's schedule rather than sitting through it.
 */
export const JOB_LEASE_MINUTES = 30;

/**
 * How many items one run may touch.
 *
 * A bound is not a performance tuning knob here — it is what makes the run's
 * report meaningful. A run that says "attempted 40" against a limit of 40 is
 * telling you there was more work than it was allowed to do, and that is a
 * fact worth being able to read.
 */
export const JOB_ITEM_LIMIT = 40;

/** How far back a nightly run is allowed to consider. */
export const JOB_LOOKBACK_DAYS = 7;

export type JobWindow = { readonly start: string; readonly end: string };

/**
 * The slice of time a run may consider, ending at the moment it started.
 *
 * The end is the run's own start rather than "now" so that everything the run
 * writes refers to one instant. A window whose end moves while the run is in
 * progress cannot be replayed, and replay is most of the reason the ledger
 * exists.
 */
export function jobWindow(startedAt: Date, lookbackDays = JOB_LOOKBACK_DAYS): JobWindow {
  const end = startedAt.getTime();
  const days = Number.isFinite(lookbackDays) && lookbackDays > 0 ? lookbackDays : JOB_LOOKBACK_DAYS;
  return {
    start: new Date(end - days * 86_400_000).toISOString(),
    end: new Date(end).toISOString(),
  };
}

/**
 * The identity of one run: the job and the period it belongs to.
 *
 * A nightly job's period is the UTC day. It is deliberately not the athlete's
 * local day — a run covers every athlete at once, and there is no single local
 * day for a set of people in different time zones. What each athlete's own day
 * boundary means is a question for the work inside the run, not for the run's
 * identity.
 */
export function runKeyFor(at: Date): string {
  const iso = at.toISOString();
  // `2026-09-08T03:00:00.000Z` → `2026-09-08`.
  return iso.slice(0, 10);
}

/** What the ledger already holds for this identity, if anything. */
export type ExistingRun = {
  readonly status: "running" | "succeeded" | "failed";
  /** When the existing run claimed the identity. */
  readonly startedAt: string;
};

/**
 * `claim`    — nothing holds this identity; start.
 * `reclaim`  — a run holds it, but it stopped reporting long enough ago that
 *              its container is gone. Take it over.
 * `skip`     — somebody is working on it, or it is already done.
 */
export type ClaimDecision = "claim" | "reclaim" | "skip";

export function claimDecision(
  existing: ExistingRun | null,
  now: Date,
  leaseMinutes = JOB_LEASE_MINUTES,
): ClaimDecision {
  if (existing === null) return "claim";
  // A finished run is finished, whichever way it went. A failed night is not
  // retried inside the same period: the failure is the record, and the next
  // period's run is the retry. Retrying immediately would turn one broken
  // night into a loop that hides the breakage.
  if (existing.status !== "running") return "skip";

  const startedAt = Date.parse(existing.startedAt);
  // An unparseable timestamp is not evidence that the lease expired. Leaving
  // it alone costs one skipped night; overriding it risks two runs at once.
  if (!Number.isFinite(startedAt)) return "skip";

  const lease =
    Number.isFinite(leaseMinutes) && leaseMinutes > 0 ? leaseMinutes : JOB_LEASE_MINUTES;
  const expiresAt = startedAt + lease * 60_000;
  return now.getTime() >= expiresAt ? "reclaim" : "skip";
}

/** What one run did, as the ledger records it. */
export type JobOutcome = {
  readonly status: "succeeded" | "failed";
  readonly attempted: number;
  readonly succeeded: number;
  readonly failed: number;
  /** Whether the bound, not the work, is what ended the run. */
  readonly boundReached: boolean;
};

/**
 * The run's own verdict on itself.
 *
 * A run that touched nothing succeeded: there was no work, and reporting that
 * as a failure would put a red mark on a quiet night. A run where every single
 * item failed did not succeed, whatever the items were — that is the shape of
 * a broken dependency rather than of unlucky data. A run where some failed
 * still succeeded, because the successes are real and recorded, and the
 * failures are counted rather than hidden.
 */
export function summariseRun(
  results: readonly { readonly ok: boolean }[],
  limit = JOB_ITEM_LIMIT,
): JobOutcome {
  const attempted = results.length;
  const succeeded = results.filter((result) => result.ok).length;
  const failed = attempted - succeeded;
  return {
    status: attempted > 0 && succeeded === 0 ? "failed" : "succeeded",
    attempted,
    succeeded,
    failed,
    boundReached: attempted >= limit,
  };
}

/**
 * Postgres unique-violation, checked by code rather than by message so a
 * locale or version change cannot turn a lost race into a crash.
 */
export const UNIQUE_VIOLATION = "23505";

/**
 * What a failed claim insert means.
 *
 * Losing the insert is the answer, not an error: the unique index is the whole
 * locking scheme, and somebody else holding the period is exactly what it is
 * there to tell us. Every other write failure is a ledger we could not write,
 * and a job must not run past a ledger it cannot write — running blind risks
 * doing the night twice, where not running costs one night and says so.
 */
export function claimInsertOutcome(errorCode: string | undefined): "skipped" | "unavailable" {
  return errorCode === UNIQUE_VIOLATION ? "skipped" : "unavailable";
}

/** The row a finished run leaves behind. */
export type ClosingLedgerUpdate = {
  readonly status: "succeeded" | "failed";
  readonly finished_at: string;
  readonly attempted: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly error_code?: string;
};

/**
 * The closing write, as a value rather than as an inline object.
 *
 * These are the fields the Night Lab panel and anybody debugging a quiet night
 * read, and two invariants matter enough to be worth testing: a failed run
 * always carries a code somebody can act on, and a succeeded one never carries
 * one — a green row with an error code in it is a row nobody can interpret.
 */
export function closingLedgerUpdate(
  outcome: JobOutcome,
  fatalCode: string | null,
  finishedAt: Date,
): ClosingLedgerUpdate {
  const status = fatalCode ? "failed" : outcome.status;
  return {
    status,
    finished_at: finishedAt.toISOString(),
    attempted: outcome.attempted,
    succeeded: outcome.succeeded,
    failed: outcome.failed,
    // `ALL_ITEMS_FAILED` is the only way a run fails without throwing: it
    // attempted work and every item of it failed.
    ...(status === "failed" ? { error_code: fatalCode ?? "ALL_ITEMS_FAILED" } : {}),
  };
}
