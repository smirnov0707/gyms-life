import { describe, expect, it } from "vitest";
import {
  gatherOutcome,
  nightLabCandidates,
  type EvidenceSighting,
  type SourceRead,
} from "./night-lab.engine";

/**
 * A nightly run has a bound, so which athletes it spends that bound on is a
 * decision. "Whoever the database returned first" is also a decision — just an
 * unexamined one.
 */

const seen = (userId: string, at: string): EvidenceSighting => ({ userId, at });

describe("who a nightly run looks at", () => {
  it("takes each athlete once, however many sources saw them", () => {
    // A finished workout and a watch sync are one athlete, not two.
    const candidates = nightLabCandidates(
      [seen("a", "2026-09-07T20:00:00Z"), seen("a", "2026-09-07T22:00:00Z")],
      10,
    );
    expect(candidates).toEqual([{ userId: "a", newestEvidenceAt: "2026-09-07T22:00:00Z" }]);
  });

  it("dates an athlete by their newest evidence, whatever order it arrived in", () => {
    const candidates = nightLabCandidates(
      [seen("a", "2026-09-07T22:00:00Z"), seen("a", "2026-09-07T06:00:00Z")],
      10,
    );
    expect(candidates[0]?.newestEvidenceAt).toBe("2026-09-07T22:00:00Z");
  });

  it("spends the bound on the freshest evidence", () => {
    // The athletes left out are the ones whose data has been waiting longest,
    // and the next run still finds them. A night that spends its bound on
    // stale athletes leaves the fresh ones until somebody opens the app.
    const candidates = nightLabCandidates(
      [
        seen("stale", "2026-09-01T10:00:00Z"),
        seen("fresh", "2026-09-07T23:00:00Z"),
        seen("middle", "2026-09-05T10:00:00Z"),
      ],
      2,
    );
    expect(candidates.map((candidate) => candidate.userId)).toEqual(["fresh", "middle"]);
  });

  it("picks the same athletes twice over the same data", () => {
    // A selection that is not reproducible cannot be audited against the
    // ledger row that records it.
    const sightings = [
      seen("b", "2026-09-07T10:00:00Z"),
      seen("a", "2026-09-07T10:00:00Z"),
      seen("c", "2026-09-07T10:00:00Z"),
    ];
    expect(nightLabCandidates(sightings, 2).map((entry) => entry.userId)).toEqual(["a", "b"]);
    expect(nightLabCandidates([...sightings].reverse(), 2).map((entry) => entry.userId)).toEqual([
      "a",
      "b",
    ]);
  });

  it("drops a sighting whose timestamp cannot be read", () => {
    // Not evidence of anything. Dating it to the epoch would push that athlete
    // to the back of every run forever.
    expect(nightLabCandidates([seen("a", "whenever")], 10)).toEqual([]);
  });

  it("ignores a sighting with no athlete behind it", () => {
    expect(nightLabCandidates([seen("", "2026-09-07T10:00:00Z")], 10)).toEqual([]);
  });

  it("returns nothing on a night with no new evidence", () => {
    // Not a failure. There was nothing to learn, and the run says so.
    expect(nightLabCandidates([], 10)).toEqual([]);
  });

  it("returns nothing when the bound leaves no room", () => {
    expect(nightLabCandidates([seen("a", "2026-09-07T10:00:00Z")], 0)).toEqual([]);
    expect(nightLabCandidates([seen("a", "2026-09-07T10:00:00Z")], -1)).toEqual([]);
  });
});

describe("whether the run could see anything at all", () => {
  const read = (readable: boolean): SourceRead => ({
    readable,
    sightings: readable ? [seen("a", "2026-09-07T10:00:00Z")] : [],
  });

  it("is blind when no source answered", () => {
    // The failure this was written for. A run that cannot read anything finds
    // no candidates, attempts nothing, and — because a night with no work is a
    // successful night — would file itself as a quiet one. "Nobody produced
    // anything" and "we could not look" would be the same green row.
    expect(gatherOutcome([read(false), read(false), read(false)])).toBe("blind");
  });

  it("is partial when one source answered and another did not", () => {
    // Still worth running: what it can see is real, and the next run finds the
    // athletes behind the source that failed.
    expect(gatherOutcome([read(true), read(false)])).toBe("partial");
  });

  it("is a clean read when every source answered", () => {
    expect(gatherOutcome([read(true), read(true)])).toBe("read");
  });

  it("counts a source that answered with nothing as answered", () => {
    // An empty source is a source that said "nobody". That is an answer.
    expect(gatherOutcome([{ readable: true, sightings: [] }])).toBe("read");
  });

  it("is not blind when there were no sources to read", () => {
    expect(gatherOutcome([])).toBe("read");
  });
});
