import { describe, expect, it } from "vitest";
import { JobFailure } from "./background-job.server";

/**
 * The ledger's `error_code` is constrained in the database. A code the
 * constraint rejects fails the closing write, which leaves the row `running` —
 * so a job that tried to say why it failed would instead say nothing at all,
 * and wait out a lease before the next period could even try.
 */

describe("a job saying why it stopped", () => {
  it("keeps a code the ledger will accept", () => {
    expect(new JobFailure("EVIDENCE_UNREADABLE").code).toBe("EVIDENCE_UNREADABLE");
  });

  it("falls back rather than writing a code the constraint would reject", () => {
    // Each of these fails `^[A-Z][A-Z0-9_]{2,63}$`, and a rejected write is a
    // worse outcome than a vaguer word.
    for (const bad of ["lowercase", "HAS SPACES", "AB", "1ABC", "WITH-DASH", "A".repeat(65)]) {
      expect(new JobFailure(bad).code).toBe("JOB_THREW");
    }
  });

  it("is an Error, so a job may throw it like any other", () => {
    const failure = new JobFailure("EVIDENCE_UNREADABLE");
    expect(failure).toBeInstanceOf(Error);
    expect(failure.name).toBe("JobFailure");
  });

  it("carries its code as the message when none is given", () => {
    expect(new JobFailure("EVIDENCE_UNREADABLE").message).toBe("EVIDENCE_UNREADABLE");
  });
});
