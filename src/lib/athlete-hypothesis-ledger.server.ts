import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { AthleteHypothesisSchema, type AthleteHypothesis } from "./athlete-hypothesis.schema";
import {
  AthleteHypothesisLedgerSummarySchema,
  buildHypothesisLedgerTransitions,
  type AthleteHypothesisLedgerSummary,
} from "./athlete-hypothesis-ledger";
import { recordPersonalTimelineEvent } from "./personal-timeline.server";

const HYPOTHESIS_LEDGER_READ_LIMIT = 200;

const HypothesisTimelineRowSchema = z
  .object({
    summary: z.unknown(),
  })
  .strict();

function transitionReference(transition: AthleteHypothesisLedgerSummary): string {
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        hypothesisId: transition.hypothesisId,
        previousStatus: transition.previousStatus,
        status: transition.status,
        evidenceCount: transition.evidenceCount,
        minimumEvidenceCount: transition.minimumEvidenceCount,
      }),
    )
    .digest("hex")
    .slice(0, 24);

  return `athlete-hypothesis:${transition.hypothesisId}:${fingerprint}`;
}

/**
 * Reconciles the current deterministic hypothesis state into the canonical
 * Personal Timeline ledger. This is deliberately fail-open: the current Lab
 * state remains authoritative even if its secondary audit trail cannot be
 * read or written during this request.
 */
export async function reconcileAthleteHypothesisLedger(
  supabase: SupabaseClient<Database>,
  userId: string,
  hypotheses: AthleteHypothesis[],
  timeZone: string,
  now = new Date(),
): Promise<void> {
  try {
    const current = z.array(AthleteHypothesisSchema).parse(hypotheses);
    const { data, error } = await supabase
      .from("personal_timeline_events")
      .select("summary")
      .eq("user_id", userId)
      .eq("event_type", "hypothesis_transition")
      .eq("source_system", "gymslife")
      .eq("source_table", "athlete_hypothesis")
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(HYPOTHESIS_LEDGER_READ_LIMIT);

    if (error || data === null) throw new Error("Hypothesis ledger read failed.");

    const previousEntries = z
      .array(HypothesisTimelineRowSchema)
      .parse(data)
      .flatMap((row) => {
        const parsed = AthleteHypothesisLedgerSummarySchema.safeParse(row.summary);
        return parsed.success ? [parsed.data] : [];
      });

    const transitions = buildHypothesisLedgerTransitions(current, previousEntries);
    const occurredAt = now.toISOString();

    for (const transition of transitions) {
      await recordPersonalTimelineEvent(userId, {
        eventType: "hypothesis_transition",
        occurredAt,
        timeZone,
        provenance: "calculated",
        sourceSystem: "gymslife",
        sourceTable: "athlete_hypothesis",
        sourceReference: transitionReference(transition),
        summary: transition,
      });
    }
  } catch (cause) {
    const { recordObservabilityEvent } = await import("./observability.server");
    await recordObservabilityEvent({
      eventName: "athlete_hypothesis_ledger.reconcile",
      outcome: "failure",
      userId,
      errorCode: "ATHLETE_HYPOTHESIS_LEDGER_RECONCILE_FAILED",
      metadata: { hypothesis_count: hypotheses.length },
    });
    void cause;
  }
}
