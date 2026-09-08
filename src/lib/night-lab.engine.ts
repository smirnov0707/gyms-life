/**
 * Which athletes a nightly run should look at, and in what order.
 *
 * The constitution's Night Lab is meant to produce "while you slept,
 * GYMS.LIFE learned". The honest version of that sentence needs two things:
 * the work has to happen, and it has to have been worth happening. Refreshing
 * the state of somebody who has produced no new evidence since the last run
 * costs a database round trip and learns nothing, and it makes the run's own
 * counts meaningless — a night that "processed 40 athletes" without new data
 * for any of them has not learned anything about anyone.
 *
 * So a run considers only athletes with new evidence inside its window, and it
 * takes the ones whose evidence is freshest first. When there are more than the
 * bound allows, the ones left out are the ones whose data has been sitting
 * longest — deliberately, because the next run will still find them, whereas a
 * night that spends its bound on stale athletes leaves the fresh ones
 * unprocessed until somebody opens the app.
 *
 * Pure and total.
 */

/** One athlete, and the most recent moment they produced evidence. */
export type EvidenceSighting = {
  readonly userId: string;
  /** ISO timestamp of the evidence. */
  readonly at: string;
};

export type NightLabCandidate = {
  readonly userId: string;
  readonly newestEvidenceAt: string;
};

/** What one evidence source produced, and whether it could be read at all. */
export type SourceRead = {
  readonly readable: boolean;
  readonly sightings: readonly EvidenceSighting[];
};

/**
 * `read`    — every source answered.
 * `partial` — some source could not be read. The run proceeds on what it has;
 *             the athletes it misses are found by the next one.
 * `blind`   — no source could be read at all.
 *
 * The last of those is the distinction this function exists for. A run that
 * cannot read anything finds no candidates, attempts nothing, and — because a
 * night with no work is a successful night — would file itself as a quiet one.
 * "Nobody produced anything" and "we could not look" would then be the same
 * green row in the ledger, and the panel built on that ledger would tell
 * athletes their Twin was simply not due an update. It is the defect this
 * audit has been closing everywhere else, one level down.
 */
export type GatherOutcome = "read" | "partial" | "blind";

export function gatherOutcome(reads: readonly SourceRead[]): GatherOutcome {
  // No sources configured is not a failed read; there was nothing to fail.
  if (reads.length === 0) return "read";
  if (reads.every((read) => !read.readable)) return "blind";
  return reads.some((read) => !read.readable) ? "partial" : "read";
}

/**
 * Collapses sightings from several sources into one ordered, bounded list.
 *
 * An athlete who finished a workout and synced a watch appears twice; they are
 * one candidate, dated by whichever came later. Ties break on the id so that
 * two runs over the same data pick the same athletes — a run whose selection is
 * not reproducible cannot be audited against its own ledger row.
 */
export function nightLabCandidates(
  sightings: readonly EvidenceSighting[],
  limit: number,
): readonly NightLabCandidate[] {
  const newest = new Map<string, string>();
  for (const sighting of sightings) {
    if (!sighting.userId) continue;
    const parsed = Date.parse(sighting.at);
    // An unreadable timestamp is not evidence of anything. Dropping it is
    // safer than dating an athlete to the epoch and starving them forever.
    if (!Number.isFinite(parsed)) continue;
    const seen = newest.get(sighting.userId);
    if (seen === undefined || sighting.at > seen) newest.set(sighting.userId, sighting.at);
  }

  const bound = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 0;
  return [...newest.entries()]
    .map(([userId, newestEvidenceAt]) => ({ userId, newestEvidenceAt }))
    .sort(
      (left, right) =>
        (left.newestEvidenceAt < right.newestEvidenceAt
          ? 1
          : left.newestEvidenceAt > right.newestEvidenceAt
            ? -1
            : 0) || left.userId.localeCompare(right.userId),
    )
    .slice(0, bound);
}
