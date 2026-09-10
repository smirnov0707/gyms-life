import { randomUUID } from "node:crypto";
import type { Json } from "@/integrations/supabase/types";
import type { DigitalAthleteState } from "./digital-athlete.schema";
import { dayBoundsInTimeZone, IsoDaySchema, IanaTimeZoneSchema } from "./local-day";
import { isWorkoutCompletionShadowEligibleAction } from "./prediction-shadow-ledger";
import type { TodayDecisionAction } from "./today-decision.schema";
import { predictWorkoutCompletion } from "./workout-completion-prediction.engine";

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
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { reviewPendingWorkoutPredictions } = await import("./prediction-review.server");
  return (await reviewPendingWorkoutPredictions(supabaseAdmin, userId, now)).evaluated;
}
