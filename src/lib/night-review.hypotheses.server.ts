import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { DigitalAthleteState } from "./digital-athlete.schema";
import { buildAthleteHypotheses } from "./athlete-hypothesis.service";
import {
  AthleteHypothesisLedgerSummarySchema,
  buildHypothesisLedgerTransitions,
} from "./athlete-hypothesis-ledger";
import { HypothesisReviewSchema, type HypothesisReview } from "./night-review.schema";
import { serializeJson } from "./json.schema";
/** The existing hypothesis ledger remains canonical; this path requires confirmed writes. */
export async function reviewNightHypotheses(
  client: SupabaseClient<Database>,
  userId: string,
  state: DigitalAthleteState,
  snapshotId: string,
  timeZone: string,
  now = new Date(),
): Promise<HypothesisReview> {
  z.string().uuid().parse(userId);
  z.string().uuid().parse(snapshotId);
  const current = buildAthleteHypotheses(state);
  // Read the most recent state for EACH current hypothesis. A busy hypothesis
  // cannot consume a global row limit and hide another one's previous state.
  const prior = await Promise.all(
    current.map(async (hypothesis) => {
      const { data, error } = await client
        .from("personal_timeline_events")
        .select("summary")
        .eq("user_id", userId)
        .eq("event_type", "hypothesis_transition")
        .eq("source_system", "gymslife")
        .eq("source_table", "athlete_hypothesis")
        .contains("summary", { hypothesisId: hypothesis.id })
        .order("occurred_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error("HYPOTHESIS_REVIEW_UNAVAILABLE");
      if (!data) return null;
      const parsed = AthleteHypothesisLedgerSummarySchema.parse(data.summary);
      if (parsed.hypothesisId !== hypothesis.id)
        throw new Error("HYPOTHESIS_REVIEW_IDENTITY_MISMATCH");
      return parsed;
    }),
  );
  const transitions = buildHypothesisLedgerTransitions(
    current,
    prior.flatMap((row) => (row ? [row] : [])),
    snapshotId,
  );
  for (const transition of transitions) {
    const sourceReference = `athlete-hypothesis:${transition.hypothesisId}:${snapshotId}`;
    const { error: writeError } = await client.from("personal_timeline_events").upsert(
      {
        user_id: userId,
        event_type: "hypothesis_transition",
        occurred_at: now.toISOString(),
        timezone: timeZone,
        provenance: "calculated",
        source_system: "gymslife",
        source_table: "athlete_hypothesis",
        source_reference: sourceReference,
        summary: serializeJson(transition),
      },
      { onConflict: "user_id,source_system,source_reference,event_type", ignoreDuplicates: true },
    );
    if (writeError) throw new Error("HYPOTHESIS_REVIEW_WRITE_FAILED");
    const { data: saved, error: readError } = await client
      .from("personal_timeline_events")
      .select("summary")
      .eq("user_id", userId)
      .eq("event_type", "hypothesis_transition")
      .eq("source_system", "gymslife")
      .eq("source_reference", sourceReference)
      .maybeSingle();
    if (readError || !saved) throw new Error("HYPOTHESIS_REVIEW_WRITE_UNCONFIRMED");
    const parsed = AthleteHypothesisLedgerSummarySchema.parse(saved.summary);
    // A concurrent reader may have recorded the same transition first; do not rewrite its history.
    if (
      parsed.hypothesisId !== transition.hypothesisId ||
      parsed.athleteStateSnapshotId !== snapshotId ||
      parsed.status !== transition.status
    )
      throw new Error("HYPOTHESIS_REVIEW_CONFLICT");
  }
  return HypothesisReviewSchema.parse({ current, transitions });
}
