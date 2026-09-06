import { randomUUID } from "node:crypto";
import type { Json } from "@/integrations/supabase/types";
import type { DigitalAthleteState } from "./digital-athlete.schema";
import { dayBoundsInTimeZone, IsoDaySchema, IanaTimeZoneSchema } from "./local-day";
import { AthletePredictionSchema, type AthletePrediction } from "./prediction.schema";
import {
  evaluateWorkoutCompletionShadowPrediction,
  isWorkoutCompletionShadowEligibleAction,
} from "./prediction-shadow-ledger";
import type { TodayDecisionAction } from "./today-decision.schema";
import { predictWorkoutCompletion } from "./workout-completion-prediction.engine";

const RECONCILIATION_LIMIT = 64;
const COMPLETED_SESSION_LIMIT = 512;

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

function pendingWorkoutPrediction(value: unknown): AthletePrediction | null {
  const parsed = AthletePredictionSchema.safeParse(value);
  if (!parsed.success) return null;
  if (parsed.data.target !== "workout_completion" || parsed.data.maturity !== "shadow") return null;
  if (parsed.data.actual !== null || parsed.data.evaluatedAt !== null) return null;
  return parsed.data;
}

function completionInsidePredictionWindow(
  prediction: AthletePrediction,
  completedAt: readonly string[],
): string | null {
  const generatedAtMs = Date.parse(prediction.generatedAt);
  const horizonEndsAtMs = Date.parse(prediction.horizonEndsAt);
  return (
    completedAt.find((timestamp) => {
      const timestampMs = Date.parse(timestamp);
      return timestampMs >= generatedAtMs && timestampMs <= horizonEndsAtMs;
    }) ?? null
  );
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
 * Reconciles a bounded set of pending forecasts against canonical completed
 * workout sessions. Decision status is intentionally not used as the actual:
 * multiple Today records may exist for one day as the athlete snapshot evolves.
 *
 * A session finished inside [generatedAt, horizonEndsAt] is positive evidence.
 * If no such session exists, non-completion becomes observable only after the
 * horizon. Already-observed prediction JSON is protected by a DB contains guard.
 */
export async function reconcileWorkoutCompletionShadowPredictions(
  userId: string,
  now = new Date(),
): Promise<number> {
  const evaluatedAt = now.toISOString();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: records, error } = await supabaseAdmin
    .from("decision_records")
    .select("id, prediction")
    .eq("user_id", userId)
    .not("prediction", "is", null)
    .order("decision_on", { ascending: false })
    .limit(RECONCILIATION_LIMIT);
  if (error) throw new Error("Could not read shadow predictions for reconciliation.");

  const pending = (records ?? []).flatMap((record) => {
    const prediction = pendingWorkoutPrediction(record.prediction);
    return prediction ? [{ id: record.id, prediction }] : [];
  });
  const [firstPending] = pending;
  if (!firstPending) return 0;

  const earliestGeneratedAt = pending.reduce(
    (earliest, candidate) =>
      Date.parse(candidate.prediction.generatedAt) < Date.parse(earliest)
        ? candidate.prediction.generatedAt
        : earliest,
    firstPending.prediction.generatedAt,
  );

  const { data: sessions, error: sessionsError } = await supabaseAdmin
    .from("workout_sessions")
    .select("finished_at")
    .eq("user_id", userId)
    .not("finished_at", "is", null)
    .gte("finished_at", earliestGeneratedAt)
    .lte("finished_at", evaluatedAt)
    .order("finished_at", { ascending: true })
    .limit(COMPLETED_SESSION_LIMIT);
  if (sessionsError)
    throw new Error("Could not read completed workouts for prediction evaluation.");

  const completedAt = (sessions ?? []).flatMap((session) =>
    session.finished_at ? [session.finished_at] : [],
  );

  let reconciled = 0;
  for (const candidate of pending) {
    const observedCompletionAt = completionInsidePredictionWindow(
      candidate.prediction,
      completedAt,
    );
    const evaluated = evaluateWorkoutCompletionShadowPrediction({
      prediction: candidate.prediction,
      actual: observedCompletionAt !== null,
      evaluatedAt: observedCompletionAt ?? evaluatedAt,
    });
    if (!evaluated) continue;

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("decision_records")
      .update({ prediction: toJson(evaluated) })
      .eq("id", candidate.id)
      .eq("user_id", userId)
      .contains("prediction", { actual: null, evaluatedAt: null })
      .select("id");
    if (updateError) throw new Error("Could not reconcile a shadow prediction.");
    if ((updated?.length ?? 0) > 0) reconciled += 1;
  }

  return reconciled;
}
