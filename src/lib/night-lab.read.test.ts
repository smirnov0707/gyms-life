import { describe, expect, it } from "vitest";
import { overnightWork, type OvernightRow } from "./night-lab.read";

/**
 * "While you slept, GYMS.LIFE learned" is the one sentence in the constitution
 * that is easiest to say falsely. These are the conditions under which it may
 * be said at all.
 */

const row = (occurredAt: string, runKey = occurredAt.slice(0, 10)): OvernightRow => ({
  occurredAt,
  sourceReference: runKey,
});

const at = (iso: string) => new Date(iso);

describe("what may be said about the athlete's overnight work", () => {
  it("names the most recent run and how long ago it was", () => {
    const work = overnightWork(
      [row("2026-09-06T03:10:00.000Z"), row("2026-09-08T03:10:00.000Z")],
      at("2026-09-08T09:00:00.000Z"),
    );
    expect(work).toEqual({
      state: "ran",
      runKey: "2026-09-08",
      at: "2026-09-08T03:10:00.000Z",
      nightsAgo: 0,
    });
  });

  it("counts whole nights, so a run this morning is not yesterday's", () => {
    expect(
      overnightWork([row("2026-09-08T03:10:00.000Z")], at("2026-09-09T09:00:00.000Z")),
    ).toMatchObject({ nightsAgo: 1 });
    expect(
      overnightWork([row("2026-09-01T03:10:00.000Z")], at("2026-09-08T09:00:00.000Z")),
    ).toMatchObject({ nightsAgo: 7 });
  });

  it("says never when no run has ever included this athlete", () => {
    // The ordinary state for somebody new. Not a claim that anything broke.
    expect(overnightWork([], at("2026-09-08T09:00:00.000Z"))).toEqual({ state: "never" });
  });

  it("says it could not read, which is not the same as never", () => {
    // A failed read rendered as `never` tells an athlete whose Twin is
    // maintained nightly that nothing has ever happened to it.
    expect(overnightWork(null, at("2026-09-08T09:00:00.000Z"))).toEqual({ state: "unreadable" });
    expect(overnightWork(null)).not.toEqual(overnightWork([]));
  });

  it("ignores a row whose time cannot be read rather than dating it to the epoch", () => {
    expect(overnightWork([row("whenever")], at("2026-09-08T09:00:00.000Z"))).toEqual({
      state: "never",
    });
    expect(
      overnightWork(
        [row("whenever"), row("2026-09-08T03:10:00.000Z")],
        at("2026-09-08T09:00:00.000Z"),
      ),
    ).toMatchObject({ runKey: "2026-09-08" });
  });

  it("never reports a negative number of nights", () => {
    // A row dated ahead of the clock is a clock disagreement, not a lie, and
    // "-1 nights ago" is not a thing to print at somebody.
    expect(
      overnightWork([row("2026-09-09T03:10:00.000Z")], at("2026-09-08T09:00:00.000Z")),
    ).toMatchObject({ nightsAgo: 0 });
  });

  it("carries the run key, so the row and the ledger point at each other", () => {
    const work = overnightWork(
      [row("2026-09-08T03:10:00.000Z", "2026-09-08")],
      at("2026-09-08T09:00:00.000Z"),
    );
    expect(work.state === "ran" ? work.runKey : null).toBe("2026-09-08");
  });
});
