import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { AthletePredictionSchema } from "./prediction.schema";
import { evaluateWorkoutCompletionShadowPrediction } from "./prediction-shadow-ledger";
import { PredictionReviewSchema, type PredictionReview } from "./night-review.schema";
import { serializeJson } from "./json.schema";
const MAX_PREDICTIONS = 64,
  MAX_COMPLETIONS = 512;
/** Only pending forecasts are counted; a truncated completion source can never prove absence. */
export async function reviewPendingWorkoutPredictions(
  client: SupabaseClient<Database>,
  userId: string,
  now = new Date(),
): Promise<PredictionReview> {
  z.string().uuid().parse(userId);
  const evaluatedAt = now.toISOString();
  const { data, error } = await client
    .from("decision_records")
    .select("id,decision_on,prediction")
    .eq("user_id", userId)
    .contains("prediction", {
      target: "workout_completion",
      maturity: "shadow",
      actual: null,
      evaluatedAt: null,
    })
    .order("decision_on", { ascending: true })
    .order("id", { ascending: true })
    .limit(MAX_PREDICTIONS + 1);
  if (error || data === null) throw new Error("PREDICTION_REVIEW_UNAVAILABLE");
  const rows = z
    .array(
      z.object({
        id: z.string().uuid(),
        decision_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        prediction: AthletePredictionSchema,
      }),
    )
    .parse(data);
  const pending = rows.slice(0, MAX_PREDICTIONS),
    limited = rows.length > MAX_PREDICTIONS;
  if (!pending.length) return { checked: 0, evaluated: 0, independentDays: 0, pending: 0, limited };
  const earliest = new Date(
    Math.min(...pending.map((row) => Date.parse(row.prediction.generatedAt))),
  ).toISOString();
  const { data: sessions, error: sessionError } = await client
    .from("workout_sessions")
    .select("finished_at")
    .eq("user_id", userId)
    .not("finished_at", "is", null)
    .gte("finished_at", earliest)
    .lte("finished_at", evaluatedAt)
    .order("finished_at", { ascending: true })
    .limit(MAX_COMPLETIONS + 1);
  if (sessionError || sessions === null || sessions.length > MAX_COMPLETIONS)
    throw new Error("PREDICTION_COMPLETIONS_UNAVAILABLE");
  const completed = z
    .array(z.object({ finished_at: z.string().datetime({ offset: true }) }))
    .parse(sessions);
  let evaluated = 0,
    awaiting = 0;
  const days = new Set<string>();
  for (const row of pending) {
    const prediction = row.prediction;
    const positive = completed.find(
      (session) =>
        Date.parse(session.finished_at) >= Date.parse(prediction.generatedAt) &&
        Date.parse(session.finished_at) <= Date.parse(prediction.horizonEndsAt),
    );
    const observed = evaluateWorkoutCompletionShadowPrediction({
      prediction,
      actual: !!positive,
      evaluatedAt: positive?.finished_at ?? evaluatedAt,
    });
    if (!observed) {
      awaiting++;
      continue;
    }
    const { data: updated, error: updateError } = await client
      .from("decision_records")
      .update({ prediction: serializeJson(observed) })
      .eq("id", row.id)
      .eq("user_id", userId)
      .contains("prediction", {
        id: prediction.id,
        generatedAt: prediction.generatedAt,
        actual: null,
        evaluatedAt: null,
      })
      .select("id");
    if (updateError || updated === null) throw new Error("PREDICTION_REVIEW_WRITE_FAILED");
    const accepted = z.array(z.object({ id: z.string().uuid() })).parse(updated);
    if (accepted.some((value) => value.id !== row.id) || accepted.length > 1)
      throw new Error("PREDICTION_REVIEW_WRITE_UNCONFIRMED");
    if (accepted.length === 1) {
      evaluated++;
      days.add(row.decision_on);
    }
  }
  return PredictionReviewSchema.parse({
    checked: pending.length,
    evaluated,
    independentDays: days.size,
    pending: awaiting,
    limited,
  });
}
