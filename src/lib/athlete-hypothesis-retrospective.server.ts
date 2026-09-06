import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { AthleteHypothesisLedgerSummarySchema } from "./athlete-hypothesis-ledger";
import { LabHypothesisTransitionSchema, type LabHypothesisTransition } from "./lab.schema";

export const HYPOTHESIS_RETROSPECTIVE_LIMIT = 50;

export const HypothesisRetrospectiveRowSchema = z
  .object({
    occurred_at: z.string().datetime({ offset: true }),
    summary: z.unknown(),
  })
  .strict();

export type HypothesisRetrospectiveRow = z.infer<typeof HypothesisRetrospectiveRowSchema>;

/**
 * Converts newest-first internal Timeline audit rows into the public Lab
 * retrospective shape. Malformed/legacy rows are ignored rather than allowed
 * to make current Lab state unavailable.
 */
export function composeHypothesisRetrospective(rows: unknown): LabHypothesisTransition[] {
  const parsedRows = z.array(HypothesisRetrospectiveRowSchema).safeParse(rows);
  if (!parsedRows.success) return [];

  return parsedRows.data.flatMap((row) => {
    const summary = AthleteHypothesisLedgerSummarySchema.safeParse(row.summary);
    if (!summary.success) return [];

    const transition = LabHypothesisTransitionSchema.safeParse({
      ...summary.data,
      occurredAt: row.occurred_at,
    });
    return transition.success ? [transition.data] : [];
  });
}

/**
 * Lab-specific read of server-owned hypothesis audit events. This is the only
 * user surface allowed to interpret `hypothesis_transition`; generic Timeline
 * and Twin Evidence continue to exclude these derived records.
 */
export async function loadHypothesisRetrospective(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<LabHypothesisTransition[]> {
  if (!userId) return [];

  const { data, error } = await supabase
    .from("personal_timeline_events")
    .select("occurred_at,summary")
    .eq("user_id", userId)
    .eq("event_type", "hypothesis_transition")
    .eq("source_system", "gymslife")
    .eq("source_table", "athlete_hypothesis")
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(HYPOTHESIS_RETROSPECTIVE_LIMIT);

  if (error || data === null) return [];
  return composeHypothesisRetrospective(data);
}
