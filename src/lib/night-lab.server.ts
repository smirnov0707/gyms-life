import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  JobFailure,
  runBackgroundJob,
  type JobItemResult,
  type JobRunReport,
} from "./background-job.server";
import { nightLabCandidates, type SourceRead } from "./night-lab.engine";
import { recordPersonalTimelineEvent } from "./personal-timeline.server";
import type { JobWindow } from "./background-job.engine";
import { IanaTimeZoneSchema } from "./local-day";
import { runAthleteNightReview } from "./night-review.server";
import { AthletePredictionSchema } from "./prediction.schema";
const LIMIT = 500;
type EvidenceSource = {
  table:
    "workout_sessions" | "health_samples" | "daily_checkins" | "body_metrics" | "nutrition_logs";
  column: string;
};
const SOURCES: readonly EvidenceSource[] = [
  { table: "workout_sessions", column: "finished_at" },
  { table: "health_samples", column: "updated_at" },
  { table: "daily_checkins", column: "updated_at" },
  { table: "body_metrics", column: "created_at" },
  { table: "nutrition_logs", column: "created_at" },
];
async function readSightings(source: EvidenceSource, window: JobWindow): Promise<SourceRead> {
  const { data, error } = await supabaseAdmin
    .from(source.table)
    .select(`user_id,${source.column}`)
    .gte(source.column, window.start)
    .lte(source.column, window.end)
    .order(source.column, { ascending: false })
    .limit(LIMIT + 1);
  if (error || data === null || data.length > LIMIT) return { readable: false, sightings: [] };
  const parsed = z.array(z.record(z.string(), z.unknown())).safeParse(data);
  if (!parsed.success) return { readable: false, sightings: [] };
  const sightings = [];
  for (const row of parsed.data) {
    const id = z.string().uuid().safeParse(row["user_id"]),
      at = z.string().datetime({ offset: true }).safeParse(row[source.column]);
    if (!id.success || !at.success) return { readable: false, sightings: [] };
    sightings.push({ userId: id.data, at: at.data });
  }
  return { readable: true, sightings };
}
async function duePredictions(window: JobWindow): Promise<SourceRead> {
  const { data, error } = await supabaseAdmin
    .from("decision_records")
    .select("user_id,prediction")
    .contains("prediction", {
      target: "workout_completion",
      maturity: "shadow",
      actual: null,
      evaluatedAt: null,
    })
    .order("decision_on", { ascending: true })
    .limit(LIMIT + 1);
  if (error || data === null || data.length > LIMIT) return { readable: false, sightings: [] };
  const parsed = z
    .array(z.object({ user_id: z.string().uuid(), prediction: AthletePredictionSchema }))
    .safeParse(data);
  if (!parsed.success) return { readable: false, sightings: [] };
  return {
    readable: true,
    sightings: parsed.data
      .filter((row) => Date.parse(row.prediction.horizonEndsAt) <= Date.parse(window.end))
      .map((row) => ({ userId: row.user_id, at: window.end })),
  };
}
async function timeZoneFor(userId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("time_zone")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  const zone = IanaTimeZoneSchema.safeParse(data.time_zone);
  return zone.success ? zone.data : null;
}
/** One canonical bounded worker: records confirmed stages, not the fact an attempt was made. */
export async function runNightLab(options?: { now?: Date }): Promise<JobRunReport> {
  return runBackgroundJob(
    "night_lab",
    async ({ window, limit, runKey, runId, claimedAt }) => {
      const reads = await Promise.all([
        ...SOURCES.map((source) => readSightings(source, window)),
        duePredictions(window),
      ]);
      // A partial or truncated source scan cannot claim it found all eligible athletes.
      if (reads.some((read) => !read.readable))
        throw new JobFailure("EVIDENCE_UNREADABLE_OR_TRUNCATED");
      const candidates = nightLabCandidates(
        reads.flatMap((read) => read.sightings),
        limit,
      );
      const results: JobItemResult[] = [];
      const deadline = Date.now() + 10 * 60_000;
      for (const candidate of candidates) {
        if (Date.now() >= deadline) throw new JobFailure("NIGHT_REVIEW_TIME_BUDGET");
        try {
          const timeZone = await timeZoneFor(candidate.userId);
          if (!timeZone) {
            results.push({ ok: false });
            continue;
          }
          const saved = await runAthleteNightReview(supabaseAdmin, {
            userId: candidate.userId,
            runId,
            runKey,
            claimedAt,
            evidenceThrough: window.end,
            timeZone,
          });
          if (saved.review.snapshot.status === "confirmed")
            await recordPersonalTimelineEvent(candidate.userId, {
              eventType: "twin_recalculated",
              occurredAt: saved.review.reviewedAt,
              timeZone,
              provenance: "calculated",
              sourceSystem: "gymslife",
              sourceTable: "background_job_runs",
              sourceReference: runKey,
              summary: {
                job: "night_lab",
                reviewId: saved.id,
                snapshotId: saved.review.snapshot.id,
                reviewStatus: saved.review.status,
              },
            });
          results.push({ ok: saved.review.status === "completed" });
        } catch {
          results.push({ ok: false });
        }
      }
      return results;
    },
    options?.now ? { now: options.now } : {},
  );
}
