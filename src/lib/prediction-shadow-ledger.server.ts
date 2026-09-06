import { randomUUID } from "node:crypto";
import type { Json } from "@/integrations/supabase/types";
import type { DigitalAthleteState } from "./digital-athlete.schema";
import { dayBoundsInTimeZone, IsoDaySchema, IanaTimeZoneSchema } from "./local-day";
import {
  evaluateWorkoutCompletionShadowPrediction,
  isWorkoutCompletionShadowEligibleAction,
} from "./prediction-shadow-ledger";
import type { TodayDecisionAction } from "./today-decision.schema";
import { predictWorkoutCompletion } from "./workout-completion-prediction.engine";

const RECONCILIATION_LIMIT = 64;
const TRAINING_ACTIONS = ["train_adapted", "train_as_planned"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Converts a validated domain value to the generated Supabase Json contract. */
function toJson(value: unknown): Json {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) return value.map(toJson);
  if (isRecord(value)) {
    const output: { [key: string]: Json | undefined } = {};
    for (const [key, nestedValue] of Object.entries(value)) output[key] = toJson(nestedValue);
    return output;
  }
  throw new Error("Prediction contains a non-JSON value.");
}

/**
 * Captures one transparent workout-completion forecast alongside a persisted
 * Today decision. The null-only write makes repeated Today reads idempotent.
 * The result is deliberately not returned to the decision engine or UI.
 */
export async function captureWorkoutCompletionShadowPrediction(input: {
  userId: string;
  decisionId: string;
  decisionOn: string;
  action: TodayDecisionAction;
  timeZone: string;
  athleteStateSnapshotId: string;
  state: DigitalAthleteState;
  now?: Date;
}): Promise<boolean> {
  if (!isWorkoutCompletionShadowEligibleAction(input.action)) return false;

  const decisionOn = IsoDaySchema.parse(input.decisionOn);
  const timeZone = IanaTimeZoneSchema.parse(input.timeZone);
  const generatedAt = (input.now ?? new Date()).toISOString();
  const horizonEndsAt = dayBoundsInTimeZone(decisionOn, timeZone).end;
  if (Date.parse(horizonEndsAt) <= Date.parse(generatedAt)) return false;

  const prediction = predictWorkoutCompletion({
    predictionId: randomUUID(),
    generatedAt,
    horizonEndsAt,
    athleteStateSnapshotId: input.athleteStateSnapshotId,
    state: input.state,
    workoutRecommendedToday: true,
  });
  if (!prediction) return false;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("decision_records")
    .update({ prediction: toJson(prediction) })
    .eq("id", input.decisionId)
    .eq("user_id", input.userId)
    .is("prediction", null)
    .select("id");
  if (error) throw new Error("Could not store the shadow prediction.");
  return (data?.length ?? 0) > 0;
}

/**
 * Reconciles bounded historical shadow forecasts against the canonical Today
 * decision outcome. Completion is immediately observable; non-completion is
 * observable only after the stored horizon. Already-observed payloads are
 * never rewritten.
 */
export async function reconcileWorkoutCompletionShadowPredictions(
  userId: string,
  now = new Date(),
): Promise<number> {
  const evaluatedAt = now.toISOString();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: records, error } = await supabaseAdmin
    .from("decision_records")
    .select("id, status, prediction")
    .eq("user_id", userId)
    .not("prediction", "is", null)
    .order("decision_on", { ascending: false })
    .limit(RECONCILIATION_LIMIT);
  if (error) throw new Error("Could not read shadow predictions for reconciliation.");

  let reconciled = 0;
  for (const record of records ?? []) {
    const actual = record.status === "completed";
    const evaluated = evaluateWorkoutCompletionShadowPrediction({
      prediction: record.prediction,
      actual,
      evaluatedAt,
    });
    if (!evaluated) continue;

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("decision_records")
      .update({ prediction: toJson(evaluated) })
      .eq("id", record.id)
      .eq("user_id", userId)
      .eq("status", record.status)
      .contains("prediction", { actual: null, evaluatedAt: null })
      .select("id");
    if (updateError) throw new Error("Could not reconcile a shadow prediction.");
    if ((updated?.length ?? 0) > 0) reconciled += 1;
  }

  return reconciled;
}

/**
 * Records a just-completed training decision as a positive actual outcome.
 * The compare guard on the JSON payload prevents an observed prediction from
 * being overwritten by repeated workout-save requests.
 */
export async function observeCompletedWorkoutPrediction(
  userId: string,
  decisionOn: string,
  now = new Date(),
): Promise<boolean> {
  const canonicalDay = IsoDaySchema.parse(decisionOn);
  const evaluatedAt = now.toISOString();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: record, error } = await supabaseAdmin
    .from("decision_records")
    .select("id, prediction")
    .eq("user_id", userId)
    .eq("decision_on", canonicalDay)
    .in("action", [...TRAINING_ACTIONS])
    .eq("status", "completed")
    .not("prediction", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("Could not read the completed training prediction.");
  if (!record?.prediction) return false;

  const evaluated = evaluateWorkoutCompletionShadowPrediction({
    prediction: record.prediction,
    actual: true,
    evaluatedAt,
  });
  if (!evaluated) return false;

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("decision_records")
    .update({ prediction: toJson(evaluated) })
    .eq("id", record.id)
    .eq("user_id", userId)
    .eq("status", "completed")
    .contains("prediction", { actual: null, evaluatedAt: null })
    .select("id");
  if (updateError) throw new Error("Could not observe the completed workout prediction.");
  return (updated?.length ?? 0) > 0;
}
