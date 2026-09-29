import { JobFailure, runBackgroundJob, type JobRunReport } from "./background-job.server";
import { dispatchCurrentNightLab } from "./night-lab.dispatch.server";

/**
 * The nightly dispatch, recorded.
 *
 * `background_job_runs` writes its claim row before any work happens, so an
 * empty table proves the worker was never reached — which is what production
 * showed on 2026-09-29, three weeks after the schedule went live: zero ledger
 * rows, zero `night_lab_reviews`, and not one observability event. Every gate
 * between the schedule firing and the ledger's first write answered with a bare
 * `unavailable` into a Netlify log nobody reads.
 *
 * Making the dispatch a ledgered job of its own closes that gap with the
 * machinery already here: one run per night, a lease, and a refusal written
 * down as an `error_code` a person can read from the database. The reason a
 * night produced nothing is now a row, not an absence.
 *
 * The observability sink cannot hold this — `recordObservabilityEvent` requires
 * a user UUID, and a dispatch belongs to no athlete.
 */
export async function runNightLabDispatch(
  contextProvider?: () => unknown,
  options?: { now?: Date },
): Promise<JobRunReport> {
  return runBackgroundJob(
    "night_lab_dispatch",
    async () => {
      // The function's own context is passed rather than looked up, the way the
      // worker does it: a scheduled invocation must identify the deployment it
      // is actually running on, never one inferred later.
      const result = contextProvider
        ? await dispatchCurrentNightLab(contextProvider)
        : await dispatchCurrentNightLab();
      if (result.status === "queued") return [{ ok: true }];
      // `workerStatus` is dropped deliberately: the ledger's error code is a
      // fixed vocabulary, and the worker's own refusal is already recorded on
      // its side. What matters here is which gate said no.
      throw new JobFailure(result.reason);
    },
    // One dispatch is one item, so the limit is not the item budget the night
    // job uses.
    { limit: 1, ...(options?.now ? { now: options.now } : {}) },
  );
}
