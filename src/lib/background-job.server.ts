import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  claimDecision,
  jobWindow,
  runKeyFor,
  summariseRun,
  JOB_ITEM_LIMIT,
  type JobName,
  type JobOutcome,
  type JobWindow,
} from "./background-job.engine";

/**
 * Claiming, running and recording one background job.
 *
 * The ledger is the point of this file. The constitution forbids saying that
 * overnight analysis happened when it did not, and the only way to keep that
 * promise is for the claim to be a real row written before the work starts and
 * updated after it ends. Anything the product says about the night is then a
 * read of that row rather than an assumption about a schedule.
 *
 * Two containers may fire at the same minute — Netlify makes no promise that a
 * schedule fires exactly once — so the claim is a plain insert against a unique
 * index. Winning the insert is the claim; losing it is the answer that somebody
 * else already has this period, and that is the whole locking scheme. There is
 * no advisory lock to leak and no lease to renew.
 *
 * Postgres unique-violation is `23505`; it is checked by code rather than by
 * message so a locale or version change cannot turn a lost race into a crash.
 */

const UNIQUE_VIOLATION = "23505";

export type JobItemResult = { readonly ok: boolean };

export type JobRunReport =
  /** Somebody else holds this period, or it is already finished. */
  | { readonly status: "skipped"; readonly runKey: string }
  | {
      readonly status: "ran";
      readonly runKey: string;
      readonly window: JobWindow;
      /** How the run judged itself, including its own succeeded/failed verdict. */
      readonly outcome: JobOutcome;
      /**
       * Whether the ledger accepted the run's own closing write.
       *
       * False means the work happened but the row still says `running`, so the
       * next period will reclaim it after the lease and repeat tonight. That
       * is the intended recovery, and it is reported rather than hidden.
       */
      readonly recorded: boolean;
    }
  /** The ledger itself could not be written; the work was not attempted. */
  | { readonly status: "unavailable"; readonly runKey: string };

type LedgerRow = {
  id: string;
  status: string;
  started_at: string;
};

function asExistingRun(row: LedgerRow | null) {
  if (!row) return null;
  const status = row.status;
  if (status !== "running" && status !== "succeeded" && status !== "failed") return null;
  return { status, startedAt: row.started_at } as const;
}

/**
 * Runs `work` at most once for the current period, and records what it did.
 *
 * `work` is handed the window it may consider and the number of items it may
 * touch, and returns one result per item. It must not throw for a single
 * item's failure — a night where one athlete's snapshot fails is a night where
 * every other athlete's snapshot should still be written — so per-item errors
 * belong in the returned results, and only a failure of the run as a whole
 * should propagate.
 */
export async function runBackgroundJob(
  jobName: JobName,
  work: (context: { window: JobWindow; limit: number }) => Promise<readonly JobItemResult[]>,
  options?: { now?: Date; limit?: number },
): Promise<JobRunReport> {
  const now = options?.now ?? new Date();
  const limit = options?.limit ?? JOB_ITEM_LIMIT;
  const runKey = runKeyFor(now);
  const window = jobWindow(now);

  const { data: existingRow, error: readError } = await supabaseAdmin
    .from("background_job_runs")
    .select("id, status, started_at")
    .eq("job_name", jobName)
    .eq("run_key", runKey)
    .maybeSingle();

  // A ledger we cannot read is a ledger we must not write past. Running blind
  // risks doing the night's work twice; not running costs one night, and says
  // so.
  if (readError) return { status: "unavailable", runKey };

  const decision = claimDecision(asExistingRun(existingRow as LedgerRow | null), now);
  if (decision === "skip") return { status: "skipped", runKey };

  let runId: string;

  if (decision === "reclaim") {
    const previous = existingRow as LedgerRow | null;
    if (!previous) return { status: "unavailable", runKey };
    // Take the abandoned claim over by moving its start forward. The
    // `eq("status", "running")` is what makes this safe against a second
    // container reclaiming at the same moment: only one update matches.
    const { data, error } = await supabaseAdmin
      .from("background_job_runs")
      .update({ started_at: now.toISOString(), attempted: 0, succeeded: 0, failed: 0 })
      .eq("id", previous.id)
      .eq("status", "running")
      .select("id")
      .maybeSingle();
    if (error || !data) return { status: "skipped", runKey };
    runId = data.id;
  } else {
    const { data, error } = await supabaseAdmin
      .from("background_job_runs")
      .insert({
        job_name: jobName,
        run_key: runKey,
        window_start: window.start,
        window_end: window.end,
        started_at: now.toISOString(),
      })
      .select("id")
      .single();

    // Losing the insert race is the answer, not an error: somebody else has
    // this period.
    if (error) {
      return error.code === UNIQUE_VIOLATION
        ? { status: "skipped", runKey }
        : { status: "unavailable", runKey };
    }
    runId = data.id;
  }

  let results: readonly JobItemResult[] = [];
  let fatal = false;

  try {
    results = await work({ window, limit });
  } catch {
    // The run as a whole failed. The row is closed as failed rather than left
    // `running`, so the next period reads a finished night instead of waiting
    // out a lease on a container that is already gone.
    fatal = true;
  }

  const summary = summariseRun(results, limit);
  // A run that threw did not succeed, whatever its items managed first.
  const outcome: JobOutcome = fatal ? { ...summary, status: "failed" } : summary;

  // Closing the run is the write that matters most and the one easiest to
  // leave unchecked. If it fails the row stays `running`, so the next period
  // waits out a lease and then does tonight's work again — which is the right
  // self-healing behaviour, and useless if nobody can see it happened.
  const { error: closeError } = await supabaseAdmin
    .from("background_job_runs")
    .update({
      status: outcome.status,
      finished_at: new Date().toISOString(),
      attempted: outcome.attempted,
      succeeded: outcome.succeeded,
      failed: outcome.failed,
      ...(outcome.status === "failed"
        ? { error_code: fatal ? "JOB_THREW" : "ALL_ITEMS_FAILED" }
        : {}),
    })
    .eq("id", runId);

  return { status: "ran", runKey, window, outcome, recorded: !closeError };
}

/**
 * The most recent finished run of a job, for anything that wants to say what
 * happened overnight.
 *
 * Returns null when nothing has run or the ledger cannot be read, and the
 * caller must treat those as "we cannot say" rather than as "nothing
 * happened" — the distinction this whole product is built on.
 */
export async function lastFinishedRun(jobName: JobName): Promise<{
  runKey: string;
  status: "succeeded" | "failed";
  finishedAt: string;
  attempted: number;
  succeeded: number;
  failed: number;
} | null> {
  const { data, error } = await supabaseAdmin
    .from("background_job_runs")
    .select("run_key, status, finished_at, attempted, succeeded, failed")
    .eq("job_name", jobName)
    .neq("status", "running")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data || !data.finished_at) return null;
  if (data.status !== "succeeded" && data.status !== "failed") return null;

  return {
    runKey: data.run_key,
    status: data.status,
    finishedAt: data.finished_at,
    attempted: data.attempted,
    succeeded: data.succeeded,
    failed: data.failed,
  };
}
