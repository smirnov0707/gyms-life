import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { serializeJson } from "./json.schema";
import { AthletePredictionSchema } from "./prediction.schema";
import { evaluateWorkoutCompletionShadowPrediction } from "./prediction-shadow-ledger";
import {
  buildPersonalCompletionShadowPrediction,
  personalCompletionPredictionId,
} from "./personal-completion-model.engine";
import { loadActivePersonalCompletionArtifact } from "./personal-completion-model.server";
import {
  PersonalCompletionPredictionReviewSchema,
  type PersonalCompletionPredictionReview,
} from "./personal-completion-model.schema";

const PENDING_LIMIT = 64;
const COMPLETION_LIMIT = 512;

export async function capturePersonalCompletionShadowPrediction(input: {
  client: SupabaseClient<Database>;
  userId: string;
  decisionId: string;
  decisionOn: string;
}): Promise<boolean> {
  const [artifact, decision] = await Promise.all([
    loadActivePersonalCompletionArtifact(input.client, input.userId),
    input.client
      .from("decision_records")
      .select("id,decision_on,prediction")
      .eq("id", input.decisionId)
      .eq("user_id", input.userId)
      .eq("decision_on", input.decisionOn)
      .maybeSingle(),
  ]);
  if (!artifact) return false;
  if (decision.error || !decision.data) throw new Error("PERSONAL_MODEL_BASELINE_UNAVAILABLE");
  if (input.decisionOn <= artifact.trainedThrough) return false;
  const baseline = AthletePredictionSchema.safeParse(decision.data.prediction);
  if (!baseline.success) return false;
  const challenger = buildPersonalCompletionShadowPrediction({
    artifact,
    baseline: baseline.data,
    decisionOn: input.decisionOn,
    predictionId: personalCompletionPredictionId(artifact.id, input.decisionId),
  });
  if (!challenger) return false;
  const { data: id, error } = await input.client.rpc("commit_personal_model_prediction", {
    p_user_id: input.userId,
    p_artifact_id: artifact.id,
    p_decision_id: input.decisionId,
    p_decision_on: input.decisionOn,
    p_prediction: serializeJson(challenger),
  });
  if (error || !id) throw new Error("PERSONAL_MODEL_PREDICTION_WRITE_FAILED");
  const { data: stored, error: readError } = await input.client
    .from("personal_model_predictions")
    .select("id,user_id,artifact_id,decision_id,decision_on,prediction")
    .eq("id", id)
    .eq("user_id", input.userId)
    .eq("artifact_id", artifact.id)
    .eq("decision_id", input.decisionId)
    .maybeSingle();
  if (readError || !stored) throw new Error("PERSONAL_MODEL_PREDICTION_UNCONFIRMED");
  const parsed = AthletePredictionSchema.safeParse(stored.prediction);
  if (
    !parsed.success ||
    parsed.data.predicted.kind !== "probability" ||
    challenger.predicted.kind !== "probability"
  )
    return false;
  return (
    parsed.data.id === challenger.id &&
    parsed.data.modelId === challenger.modelId &&
    parsed.data.modelVersion === challenger.modelVersion &&
    parsed.data.generatedAt === challenger.generatedAt &&
    parsed.data.horizonEndsAt === challenger.horizonEndsAt &&
    parsed.data.athleteStateSnapshotId === challenger.athleteStateSnapshotId &&
    parsed.data.actual === null &&
    parsed.data.evaluatedAt === null &&
    parsed.data.predicted.value === challenger.predicted.value
  );
}

const PendingRowSchema = z.object({
  id: z.string().uuid(),
  prediction: z.unknown(),
});
export async function reviewPendingPersonalCompletionPredictions(
  client: SupabaseClient<Database>,
  userId: string,
  now = new Date(),
): Promise<PersonalCompletionPredictionReview> {
  z.string().uuid().parse(userId);
  const { data, error } = await client
    .from("personal_model_predictions")
    .select("id,prediction")
    .eq("user_id", userId)
    .contains("prediction", {
      target: "workout_completion",
      maturity: "shadow",
      actual: null,
      evaluatedAt: null,
    })
    .order("decision_on", { ascending: true })
    .order("id", { ascending: true })
    .limit(PENDING_LIMIT + 1);
  if (error || data === null) throw new Error("PERSONAL_MODEL_PENDING_UNAVAILABLE");
  const rows = z
    .array(PendingRowSchema)
    .max(PENDING_LIMIT + 1)
    .parse(data);
  const limited = rows.length > PENDING_LIMIT;
  const pending = rows.slice(0, PENDING_LIMIT).map((row) => {
    const parsed = AthletePredictionSchema.safeParse(row.prediction);
    if (!parsed.success || parsed.data.actual !== null || parsed.data.evaluatedAt !== null)
      throw new Error("PERSONAL_MODEL_PENDING_INVALID");
    return { rowId: row.id, prediction: parsed.data };
  });
  if (!pending.length)
    return PersonalCompletionPredictionReviewSchema.parse({ checked: 0, evaluated: 0, limited });
  const earliest = new Date(
    Math.min(...pending.map((row) => Date.parse(row.prediction.generatedAt))),
  ).toISOString();
  const { data: sessions, error: sessionError } = await client
    .from("workout_sessions")
    .select("finished_at")
    .eq("user_id", userId)
    .not("finished_at", "is", null)
    .gte("finished_at", earliest)
    .lte("finished_at", now.toISOString())
    .order("finished_at", { ascending: true })
    .limit(COMPLETION_LIMIT + 1);
  if (sessionError || sessions === null || sessions.length > COMPLETION_LIMIT)
    throw new Error("PERSONAL_MODEL_COMPLETIONS_UNAVAILABLE");
  const completed = z
    .array(z.object({ finished_at: z.string().datetime({ offset: true }) }))
    .parse(sessions);
  let evaluated = 0;
  for (const row of pending) {
    const positive = completed.find(
      (session) =>
        Date.parse(session.finished_at) >= Date.parse(row.prediction.generatedAt) &&
        Date.parse(session.finished_at) <= Date.parse(row.prediction.horizonEndsAt),
    );
    const observed = evaluateWorkoutCompletionShadowPrediction({
      prediction: row.prediction,
      actual: Boolean(positive),
      evaluatedAt: positive?.finished_at ?? now.toISOString(),
    });
    if (!observed) continue;
    const { data: updated, error: updateError } = await client
      .from("personal_model_predictions")
      .update({ prediction: serializeJson(observed) })
      .eq("id", row.rowId)
      .eq("user_id", userId)
      .contains("prediction", {
        id: row.prediction.id,
        generatedAt: row.prediction.generatedAt,
        actual: null,
        evaluatedAt: null,
      })
      .select("id");
    if (updateError || updated === null) throw new Error("PERSONAL_MODEL_EVALUATION_WRITE_FAILED");
    const accepted = z.array(z.object({ id: z.string().uuid() })).parse(updated);
    if (accepted.some((value) => value.id !== row.rowId) || accepted.length > 1)
      throw new Error("PERSONAL_MODEL_EVALUATION_WRITE_UNCONFIRMED");
    if (accepted.length === 1) evaluated++;
  }
  return PersonalCompletionPredictionReviewSchema.parse({
    checked: pending.length,
    evaluated,
    limited,
  });
}
