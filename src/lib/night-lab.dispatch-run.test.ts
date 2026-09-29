import { describe, expect, it } from "vitest";
import { DISPATCH_REFUSALS } from "./night-lab.dispatch";
import { JOB_NAMES } from "./background-job.engine";

/**
 * Production on 2026-09-29, three weeks after the Night Lab schedule went live:
 * `background_job_runs` held 0 rows, `night_lab_reviews` held 0 rows, and
 * `app_observability_events` held no Night Lab event of any kind. The schedule
 * fires nightly and `/.netlify/functions/night-lab` answers 403 rather than
 * 404, so the function is deployed and running.
 *
 * `runBackgroundJob` writes its claim row before it calls `work`, so an empty
 * ledger is proof that nothing ever got as far as claiming a run — every gate
 * ahead of it refused, each returning a bare `unavailable` into a log nobody
 * reads.
 */

describe("the reasons a dispatch can refuse", () => {
  it("are all codes the ledger's check constraint accepts", () => {
    // `background_job_error_code_format`: a code Postgres rejects fails the
    // closing write and leaves the row `running` — which turns a failure that
    // explained itself back into one that vanished.
    for (const refusal of DISPATCH_REFUSALS) expect(refusal).toMatch(/^[A-Z][A-Z0-9_]{2,63}$/);
  });

  it("are distinct, because two gates that read the same are one gate", () => {
    expect(new Set(DISPATCH_REFUSALS).size).toBe(DISPATCH_REFUSALS.length);
  });

  it("cover every way the dispatch can decline", () => {
    // Adding a return path without a reason is how the silence came back.
    expect(DISPATCH_REFUSALS).toEqual([
      "DISPATCH_SECRET_MISSING",
      "DISPATCH_SECRET_MALFORMED",
      "DISPATCH_ORIGIN_MISSING",
      "DISPATCH_ORIGIN_UNSAFE",
      "DISPATCH_WORKER_REFUSED",
      "DISPATCH_TRANSPORT_FAILED",
    ]);
  });
});

describe("the dispatch's own place in the ledger", () => {
  it("is a job name of its own", () => {
    // Not `night_lab`. A refusal recorded under that name would take the
    // night's run key, and `claimDecision` would then skip a later retry of the
    // real job — the record of the failure preventing recovery from it.
    expect(JOB_NAMES).toContain("night_lab_dispatch");
    expect(JOB_NAMES).toContain("night_lab");
  });

  it("uses a name the ledger's own format check accepts", () => {
    for (const name of JOB_NAMES) expect(name).toMatch(/^[a-z][a-z0-9_]{2,63}$/);
  });
});
