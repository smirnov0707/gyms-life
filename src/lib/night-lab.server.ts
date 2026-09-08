import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { refreshAthleteStateSnapshot } from "./athlete-state-snapshot.server";
import { runBackgroundJob, type JobItemResult, type JobRunReport } from "./background-job.server";
import { nightLabCandidates, type EvidenceSighting } from "./night-lab.engine";
import type { JobWindow } from "./background-job.engine";

/**
 * The Night Lab, version one: the Digital Twin is brought up to date for every
 * athlete who produced new evidence, while nobody is looking.
 *
 * What this is not, deliberately. The constitution's Night Lab eventually
 * evaluates predictions, updates hypotheses, hunts anomalies and prepares a
 * Morning Brief. None of that is here. Every one of those needs longitudinal
 * data this system does not yet have, and writing them now would produce
 * exactly the fake overnight analysis PART LXXV forbids.
 *
 * What is here is real and was previously impossible: until tonight, an
 * athlete's state was only ever recomputed because they opened a screen. A
 * snapshot written at 03:00 from a workout finished at 22:00 is the first thing
 * this product has ever learned without being asked to.
 *
 * Three properties are worth stating because they are easy to lose later:
 *
 * The run touches only athletes with new evidence. Refreshing a state that
 * nothing has changed learns nothing and makes the run's own counts a lie.
 *
 * One athlete's failure is one athlete's failure. Every refresh is caught
 * individually, so a single broken profile cannot cost everybody else their
 * night. The failures are counted in the ledger rather than swallowed.
 *
 * The athlete's own time zone is used, because the state calculation asks what
 * happened "today" and there is no single today for people in different places.
 */

/** How far back a sighting counts as new evidence. Kept to the job's window. */
type EvidenceQuery = {
  table: "workout_sessions" | "health_samples" | "daily_checkins";
  column: string;
};

/**
 * The sources that count as an athlete having produced something new.
 *
 * A finished session, a health sample from a device, and a readiness check-in.
 * Body measurements and nutrition are deliberately not here in v1: they change
 * the Twin, but they are entered by hand while the app is open, which means the
 * state was already recomputed in that request. A source belongs on this list
 * when it can arrive while nobody is looking.
 */
const EVIDENCE_SOURCES: readonly EvidenceQuery[] = [
  { table: "workout_sessions", column: "finished_at" },
  { table: "health_samples", column: "updated_at" },
  { table: "daily_checkins", column: "updated_at" },
];

/** Rows read per source. Generous against the job's own item bound. */
const SIGHTINGS_PER_SOURCE = 500;

async function sightingsFrom(
  source: EvidenceQuery,
  window: JobWindow,
): Promise<EvidenceSighting[]> {
  const { data, error } = await supabaseAdmin
    .from(source.table)
    .select(`user_id, ${source.column}`)
    .gte(source.column, window.start)
    .lte(source.column, window.end)
    .order(source.column, { ascending: false })
    .limit(SIGHTINGS_PER_SOURCE);

  // One unreadable source must not cancel the night. The run proceeds on what
  // it could read, and the athletes it misses are found by the next run.
  if (error || !data) return [];

  return (data as unknown as Record<string, unknown>[]).flatMap((row) => {
    const userId = row["user_id"];
    const at = row[source.column];
    return typeof userId === "string" && typeof at === "string" ? [{ userId, at }] : [];
  });
}

/**
 * The athlete's own time zone, or null when it could not be established.
 *
 * Null rather than a UTC fallback, and the difference matters: the state
 * calculation asks what happened "today", and today starts at a different
 * instant for everyone. Defaulting a Vilnius athlete to UTC moves their day
 * boundary by three hours, which silently puts an evening workout on the wrong
 * day in the snapshot this run exists to write. A night we cannot place is a
 * night we skip, counted as a failure rather than computed wrongly.
 *
 * A missing profile row is treated the same way. An athlete with new evidence
 * and no profile is a data-integrity problem, and it belongs in the failed
 * count where it can be seen.
 */
async function timeZoneFor(userId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("time_zone")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data.time_zone;
}

/**
 * Runs tonight's Night Lab, at most once for the period.
 *
 * Returns the ledger's own account of what happened, so a caller can report it
 * rather than assume it.
 */
export async function runNightLab(options?: { now?: Date }): Promise<JobRunReport> {
  return runBackgroundJob(
    "night_lab",
    async ({ window, limit }) => {
      const gathered = await Promise.all(
        EVIDENCE_SOURCES.map((source) => sightingsFrom(source, window)),
      );
      const candidates = nightLabCandidates(gathered.flat(), limit);

      const results: JobItemResult[] = [];
      for (const candidate of candidates) {
        try {
          const timeZone = await timeZoneFor(candidate.userId);
          if (timeZone === null) {
            results.push({ ok: false });
            continue;
          }
          await refreshAthleteStateSnapshot(supabaseAdmin, candidate.userId, timeZone);
          // The refresh either ran or it threw. A state too thin to persist
          // returns without a snapshot, and that is a success: the calculation
          // ran and correctly declined to store something it could not stand
          // behind. Counting it as a failure would mark every new athlete's
          // first night red.
          results.push({ ok: true });
        } catch {
          // Never let one athlete's broken data end the night for everyone
          // else. The count is the record; the error itself may carry personal
          // data and is not logged.
          results.push({ ok: false });
        }
      }
      return results;
    },
    options?.now ? { now: options.now } : {},
  );
}
