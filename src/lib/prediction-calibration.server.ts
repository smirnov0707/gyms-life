import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  buildPredictionCalibration,
  type StoredPredictionCalibrationCandidate,
} from "./prediction-calibration.engine";
import type { PredictionCalibration } from "./prediction-calibration.schema";

const PREDICTION_CALIBRATION_LIMIT = 200;

/**
 * Reads only the signed-in user's bounded decision ledger. This is a
 * retrospective calibration view: it never writes athlete state and its result
 * is never consumed by Today.
 *
 * A secondary read failure degrades to an empty calibration report so Lab can
 * still show canonical hypotheses and decision history.
 */
export async function loadPredictionCalibration(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<PredictionCalibration> {
  const { data, error } = await supabase
    .from("decision_records")
    .select("decision_on, prediction")
    .eq("user_id", userId)
    .not("prediction", "is", null)
    .order("decision_on", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(PREDICTION_CALIBRATION_LIMIT);

  if (error) return buildPredictionCalibration([]);

  const candidates: StoredPredictionCalibrationCandidate[] = (data ?? []).map((row) => ({
    decisionOn: row.decision_on,
    prediction: row.prediction,
  }));
  return buildPredictionCalibration(candidates);
}
