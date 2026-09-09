import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  NightReviewSchema,
  NightReviewReadSchema,
  type NightReview,
  type NightReviewRead,
} from "./night-review.schema";
import { buildNightReview } from "./night-review.engine";
import { refreshAthleteStateSnapshot } from "./athlete-state-snapshot.server";
import { reviewPendingWorkoutPredictions } from "./prediction-review.server";
import { reviewNightHypotheses } from "./night-review.hypotheses.server";
import { serializeJson } from "./json.schema";
const Stored = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  run_id: z.string().uuid(),
  report: NightReviewSchema,
});
export async function loadMorningNightReview(
  client: SupabaseClient<Database>,
  userId: string,
  now = new Date(),
): Promise<NightReviewRead> {
  z.string().uuid().parse(userId);
  try {
    const { data, error } = await client
      .from("night_lab_reviews")
      .select("id,user_id,run_id,report")
      .eq("user_id", userId)
      .lte("reviewed_at", now.toISOString())
      .order("reviewed_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { state: "unavailable" };
    if (!data) return { state: "not_run" };
    const parsed = Stored.parse(data);
    if (parsed.user_id !== userId) return { state: "unavailable" };
    return NightReviewReadSchema.parse({
      state: "ready",
      reviewId: parsed.id,
      review: parsed.report,
    });
  } catch {
    return { state: "unavailable" };
  }
}
export async function runAthleteNightReview(
  client: SupabaseClient<Database>,
  input: {
    userId: string;
    runId: string;
    runKey: string;
    claimedAt: string;
    evidenceThrough: string;
    timeZone: string;
  },
): Promise<{ id: string; review: NightReview }> {
  z.string().uuid().parse(input.userId);
  z.string().uuid().parse(input.runId);
  const { data: prior, error: readError } = await client
    .from("night_lab_reviews")
    .select("id,user_id,run_id,report")
    .eq("user_id", input.userId)
    .eq("run_id", input.runId)
    .maybeSingle();
  if (readError) throw new Error("NIGHT_REVIEW_STORE_UNAVAILABLE");
  if (prior) {
    const saved = Stored.parse(prior);
    if (saved.user_id !== input.userId || saved.run_id !== input.runId)
      throw new Error("NIGHT_REVIEW_IDENTITY_MISMATCH");
    return { id: saved.id, review: saved.report };
  }
  const cutoff = new Date(input.evidenceThrough);
  const review = await buildNightReview(input, {
    snapshot: () => refreshAthleteStateSnapshot(client, input.userId, input.timeZone, cutoff),
    predictions: () => reviewPendingWorkoutPredictions(client, input.userId, cutoff),
    hypotheses: (state, snapshotId) =>
      reviewNightHypotheses(client, input.userId, state, snapshotId, input.timeZone, cutoff),
  });
  const { data: id, error } = await client.rpc("commit_night_lab_review", {
    p_run_id: input.runId,
    p_claimed_at: input.claimedAt,
    p_user_id: input.userId,
    p_report: serializeJson(review),
  });
  if (error || !id) throw new Error("NIGHT_REVIEW_COMMIT_FAILED");
  z.string().uuid().parse(id);
  const { data: stored, error: confirmError } = await client
    .from("night_lab_reviews")
    .select("id,user_id,run_id,report")
    .eq("id", id)
    .eq("user_id", input.userId)
    .eq("run_id", input.runId)
    .maybeSingle();
  if (confirmError || !stored) throw new Error("NIGHT_REVIEW_COMMIT_UNCONFIRMED");
  const saved = Stored.parse(stored);
  if (saved.user_id !== input.userId || saved.run_id !== input.runId)
    throw new Error("NIGHT_REVIEW_IDENTITY_MISMATCH");
  return { id: saved.id, review: saved.report };
}
