import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildEvidenceReport, type EvidenceReport } from "./evidence-level.engine";
import { AthletePredictionSchema, type PredictionTarget } from "./prediction.schema";

const LEDGER_LIMIT = 400;

/**
 * How much each prediction target has actually been tested.
 *
 * Read from the decision ledger, which is where predictions are stored beside
 * the decision that carried them. A row whose prediction cannot be parsed is
 * skipped rather than counted as evidence — a malformed record is not a
 * resolved test.
 */
export const getEvidenceReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EvidenceReport> => {
    const { data, error } = await context.supabase
      .from("decision_records")
      .select("prediction")
      .eq("user_id", context.userId)
      .not("prediction", "is", null)
      .order("decision_on", { ascending: false })
      .limit(LEDGER_LIMIT);

    if (error) return buildEvidenceReport({ counts: null });

    const counts = new Map<
      PredictionTarget,
      { target: PredictionTarget; captured: number; evaluated: number; pending: number }
    >();

    for (const row of data ?? []) {
      const parsed = AthletePredictionSchema.safeParse(row.prediction);
      if (!parsed.success) continue;
      const prediction = parsed.data;
      const entry = counts.get(prediction.target) ?? {
        target: prediction.target,
        captured: 0,
        evaluated: 0,
        pending: 0,
      };
      entry.captured += 1;
      // Resolved means the outcome was actually observed. The schema already
      // refuses an `evaluatedAt` without an `actual`, so either alone would
      // do — both are checked because a count of tests is the one number this
      // panel rests on.
      if (prediction.actual !== null && prediction.evaluatedAt !== null) entry.evaluated += 1;
      else entry.pending += 1;
      counts.set(prediction.target, entry);
    }

    return buildEvidenceReport({ counts: [...counts.values()] });
  });
