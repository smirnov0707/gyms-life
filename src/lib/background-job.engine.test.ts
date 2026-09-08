import { describe, expect, it } from "vitest";
import {
  JOB_ITEM_LIMIT,
  JOB_LEASE_MINUTES,
  claimDecision,
  jobWindow,
  runKeyFor,
  summariseRun,
  type ExistingRun,
} from "./background-job.engine";

/**
 * These are the rules that decide whether work runs twice, never, or once.
 * Every one of them is a decision somebody would otherwise make inside a
 * database call at three in the morning with nobody watching.
 */

const at = (iso: string) => new Date(iso);

describe("a run's identity", () => {
  it("is the job's period, so a scheduler that fires twice claims one run", () => {
    expect(runKeyFor(at("2026-09-08T03:00:00.000Z"))).toBe("2026-09-08");
    expect(runKeyFor(at("2026-09-08T03:00:31.000Z"))).toBe("2026-09-08");
  });

  it("changes with the day", () => {
    expect(runKeyFor(at("2026-09-08T23:59:59.999Z"))).not.toBe(
      runKeyFor(at("2026-09-09T00:00:00.000Z")),
    );
  });
});

describe("the window a run may consider", () => {
  it("ends at the run's own start, not at a moving now", () => {
    // Everything the run writes refers to one instant, so the run can be
    // replayed later against the same slice.
    const started = at("2026-09-08T03:00:00.000Z");
    expect(jobWindow(started).end).toBe("2026-09-08T03:00:00.000Z");
  });

  it("looks back a bounded number of days", () => {
    const window = jobWindow(at("2026-09-08T03:00:00.000Z"), 7);
    expect(window.start).toBe("2026-09-01T03:00:00.000Z");
  });

  it("falls back to the default rather than producing an inverted window", () => {
    const window = jobWindow(at("2026-09-08T03:00:00.000Z"), -5);
    expect(Date.parse(window.start)).toBeLessThan(Date.parse(window.end));
  });
});

describe("whether a run may start", () => {
  const running = (startedAt: string): ExistingRun => ({ status: "running", startedAt });

  it("starts when nothing holds the identity", () => {
    expect(claimDecision(null, at("2026-09-08T03:00:00.000Z"))).toBe("claim");
  });

  it("stands aside while another run is still working", () => {
    expect(claimDecision(running("2026-09-08T03:00:00.000Z"), at("2026-09-08T03:05:00.000Z"))).toBe(
      "skip",
    );
  });

  it("takes over a run whose container is gone", () => {
    // Without this the job is blocked forever by one crash, and the product
    // goes on saying nothing ran — which would be true, and avoidable.
    const expired = new Date(Date.parse("2026-09-08T03:00:00.000Z") + JOB_LEASE_MINUTES * 60_000);
    expect(claimDecision(running("2026-09-08T03:00:00.000Z"), expired)).toBe("reclaim");
  });

  it("waits for the whole lease before taking over", () => {
    const justBefore = new Date(
      Date.parse("2026-09-08T03:00:00.000Z") + JOB_LEASE_MINUTES * 60_000 - 1000,
    );
    expect(claimDecision(running("2026-09-08T03:00:00.000Z"), justBefore)).toBe("skip");
  });

  it("does not re-run a period that already finished", () => {
    expect(
      claimDecision(
        { status: "succeeded", startedAt: "2026-09-08T03:00:00.000Z" },
        at("2026-09-08T09:00:00.000Z"),
      ),
    ).toBe("skip");
  });

  it("does not retry a failed period inside the same period", () => {
    // The failure is the record. Retrying immediately turns one broken night
    // into a loop that hides the breakage; the next period's run is the retry.
    expect(
      claimDecision(
        { status: "failed", startedAt: "2026-09-08T03:00:00.000Z" },
        at("2026-09-08T09:00:00.000Z"),
      ),
    ).toBe("skip");
  });

  it("treats an unreadable claim time as held rather than expired", () => {
    // Not knowing when a run started is not evidence that it finished. One
    // skipped night is cheaper than two containers writing the same rows.
    expect(claimDecision(running("not a timestamp"), at("2026-09-09T03:00:00.000Z"))).toBe("skip");
  });
});

describe("what a run says about itself", () => {
  it("succeeds on a quiet night with nothing to do", () => {
    // No work is not a failure, and a red mark on a quiet night trains
    // everyone to ignore red marks.
    expect(summariseRun([])).toMatchObject({ status: "succeeded", attempted: 0 });
  });

  it("fails when every single item failed", () => {
    // That is the shape of a broken dependency, not of unlucky data.
    expect(summariseRun([{ ok: false }, { ok: false }])).toMatchObject({
      status: "failed",
      attempted: 2,
      succeeded: 0,
      failed: 2,
    });
  });

  it("succeeds with some failures, and counts them", () => {
    expect(summariseRun([{ ok: true }, { ok: false }, { ok: true }])).toMatchObject({
      status: "succeeded",
      attempted: 3,
      succeeded: 2,
      failed: 1,
    });
  });

  it("says when the bound, not the work, ended the run", () => {
    // "attempted 40 of a limit of 40" means there was more to do. That is a
    // fact the ledger should be able to show rather than one to infer.
    const full = Array.from({ length: JOB_ITEM_LIMIT }, () => ({ ok: true }));
    expect(summariseRun(full).boundReached).toBe(true);
    expect(summariseRun(full.slice(1)).boundReached).toBe(false);
  });

  it("never reports more results than it attempted", () => {
    // The ledger enforces this too, as a check constraint. Both should hold:
    // one of them is what stops a bad write, the other is what stops a bad
    // number reaching it.
    const outcome = summariseRun([{ ok: true }, { ok: false }]);
    expect(outcome.succeeded + outcome.failed).toBeLessThanOrEqual(outcome.attempted);
  });
});
