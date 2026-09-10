import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { serializeJson } from "./json.schema";
import { dayInTimeZone, dayOffset, IanaTimeZoneSchema } from "./local-day";
import { AthletePredictionSchema } from "./prediction.schema";
import {
  PERSONAL_COMPLETION_ALGORITHM_VERSION,
  PERSONAL_COMPLETION_MIN_HOLDOUT_DAYS,
  PERSONAL_COMPLETION_TRAINING_WINDOW_DAYS,
  PERSONAL_COMPLETION_MODEL_ID,
  PersonalCompletionArtifactSchema,
  PersonalCompletionLearningStateSchema,
  type PersonalCompletionArtifact,
  type PersonalCompletionLearningState,
  type PersonalCompletionObservation,
} from "./personal-completion-model.schema";
import {
  evaluatePersonalCompletionHoldout,
  fitPersonalCompletionArtifact,
  summarizePersonalCompletionTraining,
} from "./personal-completion-model.engine";

const StoredArtifactRowSchema = z.object({
  id: z.string().uuid(),
  model_id: z.string(),
  algorithm_version: z.string(),
  source_model_id: z.string(),
  source_model_version: z.string(),
  status: z.string(),
  training_start_on: z.string(),
  trained_through: z.string(),
  training_days: z.number().int(),
  positive_days: z.number().int(),
  negative_days: z.number().int(),
  evidence_fingerprint: z.string(),
  parameters: z.unknown(),
  created_at: z.string().datetime({ offset: true }),
});
function artifactFromRow(row: unknown): PersonalCompletionArtifact {
  const parsed = StoredArtifactRowSchema.parse(row);
  return PersonalCompletionArtifactSchema.parse({
    id: parsed.id,
    modelId: parsed.model_id,
    algorithmVersion: parsed.algorithm_version,
    sourceModelId: parsed.source_model_id,
    sourceModelVersion: parsed.source_model_version,
    status: parsed.status,
    trainingStartOn: parsed.training_start_on,
    trainedThrough: parsed.trained_through,
    trainingDays: parsed.training_days,
    positiveDays: parsed.positive_days,
    negativeDays: parsed.negative_days,
    evidenceFingerprint: parsed.evidence_fingerprint,
    parameters: parsed.parameters,
    createdAt: parsed.created_at,
  });
}

function baselineObservation(
  decisionOn: string,
  raw: unknown,
): PersonalCompletionObservation | null {
  const parsed = AthletePredictionSchema.safeParse(raw);
  if (!parsed.success) return null;
  const prediction = parsed.data;
  if (
    prediction.target !== "workout_completion" ||
    prediction.modelId !== "workout-completion-usual-day-baseline" ||
    prediction.modelVersion !== "0.1.0" ||
    prediction.maturity !== "shadow" ||
    prediction.predicted.kind !== "probability" ||
    prediction.actual?.kind !== "boolean" ||
    !prediction.evaluatedAt
  )
    return null;
  return {
    decisionOn,
    predictionId: prediction.id,
    generatedAt: prediction.generatedAt,
    baselineProbability: Math.min(0.999, Math.max(0.001, prediction.predicted.value)),
    actual: prediction.actual.value,
  };
}
async function loadBaselineObservations(
  client: SupabaseClient<Database>,
  userId: string,
  throughOn: string,
): Promise<PersonalCompletionObservation[]> {
  const { data, error } = await client.rpc("read_personal_completion_training_observations", {
    p_user_id: userId,
    p_through_on: throughOn,
    p_limit_days: PERSONAL_COMPLETION_TRAINING_WINDOW_DAYS,
  });
  if (error || data === null) throw new Error("PERSONAL_MODEL_HISTORY_UNAVAILABLE");
  const rows = z
    .array(
      z.object({ decision_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), prediction: z.unknown() }),
    )
    .max(PERSONAL_COMPLETION_TRAINING_WINDOW_DAYS)
    .parse(data);
  const observations = rows.map((row) => {
    const parsed = baselineObservation(row.decision_on, row.prediction);
    if (!parsed) throw new Error("PERSONAL_MODEL_HISTORY_INVALID");
    return parsed;
  });
  return observations.sort(
    (a, b) =>
      a.decisionOn.localeCompare(b.decisionOn) ||
      Date.parse(a.generatedAt) - Date.parse(b.generatedAt),
  );
}

async function loadActiveArtifact(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<PersonalCompletionArtifact | null> {
  const { data, error } = await client
    .from("personal_model_artifacts")
    .select(
      "id,model_id,algorithm_version,source_model_id,source_model_version,status,training_start_on,trained_through,training_days,positive_days,negative_days,evidence_fingerprint,parameters,created_at",
    )
    .eq("user_id", userId)
    .eq("model_id", PERSONAL_COMPLETION_MODEL_ID)
    .in("status", ["shadow", "qualified"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("PERSONAL_MODEL_ARTIFACT_UNAVAILABLE");
  return data ? artifactFromRow(data) : null;
}
async function persistArtifact(
  client: SupabaseClient<Database>,
  userId: string,
  artifact: PersonalCompletionArtifact,
): Promise<PersonalCompletionArtifact> {
  const { error } = await client.from("personal_model_artifacts").insert({
    id: artifact.id,
    user_id: userId,
    model_id: artifact.modelId,
    algorithm_version: artifact.algorithmVersion,
    source_model_id: artifact.sourceModelId,
    source_model_version: artifact.sourceModelVersion,
    status: artifact.status,
    training_start_on: artifact.trainingStartOn,
    trained_through: artifact.trainedThrough,
    training_days: artifact.trainingDays,
    positive_days: artifact.positiveDays,
    negative_days: artifact.negativeDays,
    evidence_fingerprint: artifact.evidenceFingerprint,
    parameters: serializeJson(artifact.parameters),
  });
  if (error) throw new Error("PERSONAL_MODEL_ARTIFACT_WRITE_FAILED");
  const { data, error: readError } = await client
    .from("personal_model_artifacts")
    .select(
      "id,model_id,algorithm_version,source_model_id,source_model_version,status,training_start_on,trained_through,training_days,positive_days,negative_days,evidence_fingerprint,parameters,created_at",
    )
    .eq("id", artifact.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (readError || !data) throw new Error("PERSONAL_MODEL_ARTIFACT_UNCONFIRMED");
  return artifactFromRow(data);
}

const PersonalPredictionRowSchema = z.object({
  decision_id: z.string().uuid(),
  decision_on: z.string(),
  prediction: z.unknown(),
  created_at: z.string().datetime({ offset: true }),
});
async function loadHoldoutPairs(
  client: SupabaseClient<Database>,
  userId: string,
  artifact: PersonalCompletionArtifact,
) {
  const { data, error } = await client
    .from("personal_model_predictions")
    .select("decision_id,decision_on,prediction,created_at")
    .eq("user_id", userId)
    .eq("artifact_id", artifact.id)
    .gt("decision_on", artifact.trainedThrough)
    .order("decision_on", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(201);
  if (error || data === null || data.length > 200)
    throw new Error("PERSONAL_MODEL_HOLDOUT_UNAVAILABLE");
  const challengerRows = z.array(PersonalPredictionRowSchema).parse(data);
  if (!challengerRows.length) return [];
  const decisionIds = challengerRows.map((row) => row.decision_id);
  const { data: decisions, error: decisionError } = await client
    .from("decision_records")
    .select("id,decision_on,prediction")
    .eq("user_id", userId)
    .in("id", decisionIds);
  if (decisionError || decisions === null)
    throw new Error("PERSONAL_MODEL_BASELINE_PAIR_UNAVAILABLE");
  const byDecision = new Map(decisions.map((row) => [row.id, row]));
  return challengerRows.map((row) => {
    const baselineRow = byDecision.get(row.decision_id);
    if (!baselineRow || baselineRow.decision_on !== row.decision_on)
      throw new Error("PERSONAL_MODEL_BASELINE_PAIR_INVALID");
    const baseline = AthletePredictionSchema.safeParse(baselineRow.prediction);
    const challenger = AthletePredictionSchema.safeParse(row.prediction);
    if (!baseline.success || !challenger.success)
      throw new Error("PERSONAL_MODEL_BASELINE_PAIR_INVALID");
    if (
      baseline.data.actual?.kind !== "boolean" ||
      challenger.data.actual?.kind !== "boolean" ||
      baseline.data.actual.value !== challenger.data.actual.value ||
      baseline.data.predicted.kind !== "probability" ||
      challenger.data.predicted.kind !== "probability"
    )
      throw new Error("PERSONAL_MODEL_BASELINE_PAIR_INVALID");
    return {
      decisionOn: row.decision_on,
      actual: baseline.data.actual.value,
      baselineProbability: baseline.data.predicted.value,
      challengerProbability: challenger.data.predicted.value,
    };
  });
}
export async function ensurePersonalCompletionLearning(
  client: SupabaseClient<Database>,
  userId: string,
  now = new Date(),
  timeZone = "UTC",
): Promise<PersonalCompletionLearningState> {
  z.string().uuid().parse(userId);
  try {
    const zone = IanaTimeZoneSchema.parse(timeZone),
      today = dayInTimeZone(now, zone);
    const [history, current] = await Promise.all([
      loadBaselineObservations(client, userId, dayOffset(today, -1)),
      loadActiveArtifact(client, userId),
    ]);
    if (!current) {
      const summary = summarizePersonalCompletionTraining(history);
      if (summary.evaluatedDays < 12)
        return PersonalCompletionLearningStateSchema.parse({
          state: "insufficient_history",
          evaluatedDays: summary.evaluatedDays,
          minimumTrainingDays: 12,
        });
      if (summary.positiveDays < 1 || summary.negativeDays < 1)
        return PersonalCompletionLearningStateSchema.parse({
          state: "insufficient_variation",
          evaluatedDays: summary.evaluatedDays,
          positiveDays: summary.positiveDays,
          negativeDays: summary.negativeDays,
        });
      const artifact = fitPersonalCompletionArtifact(history, now.toISOString());
      if (!artifact) throw new Error("PERSONAL_MODEL_FIT_FAILED");
      const saved = await persistArtifact(client, userId, artifact);
      return PersonalCompletionLearningStateSchema.parse({
        state: "trained_shadow",
        artifact: saved,
      });
    }
    const holdout = evaluatePersonalCompletionHoldout(
      await loadHoldoutPairs(client, userId, current),
    );
    if (current.status === "qualified")
      return PersonalCompletionLearningStateSchema.parse({
        state: "qualified_shadow",
        artifact: current,
        holdout,
      });
    if (holdout.promotionEligible) {
      const qualification = serializeJson({ ...holdout, evaluatedAt: now.toISOString() });
      const { data, error } = await client.rpc("qualify_personal_completion_artifact", {
        p_user_id: userId,
        p_artifact_id: current.id,
        p_qualification: qualification,
      });
      if (error || data !== true) throw new Error("PERSONAL_MODEL_QUALIFICATION_UNCONFIRMED");
      const confirmed = await loadActiveArtifact(client, userId);
      if (!confirmed || confirmed.id !== current.id || confirmed.status !== "qualified")
        throw new Error("PERSONAL_MODEL_QUALIFICATION_UNCONFIRMED");
      return PersonalCompletionLearningStateSchema.parse({
        state: "qualified_shadow",
        artifact: confirmed,
        holdout,
      });
    }
    if (holdout.pairedDays >= PERSONAL_COMPLETION_MIN_HOLDOUT_DAYS) {
      const next = fitPersonalCompletionArtifact(history, now.toISOString());
      if (
        !next ||
        next.trainedThrough <= current.trainedThrough ||
        next.evidenceFingerprint === current.evidenceFingerprint
      )
        throw new Error("PERSONAL_MODEL_RETRAIN_UNAVAILABLE");
      const { data: rotatedId, error: rotateError } = await client.rpc(
        "rotate_personal_completion_artifact",
        {
          p_user_id: userId,
          p_previous_artifact_id: current.id,
          p_artifact: serializeJson(next),
        },
      );
      if (rotateError || rotatedId !== next.id)
        throw new Error("PERSONAL_MODEL_ROTATION_UNCONFIRMED");
      const confirmed = await loadActiveArtifact(client, userId);
      if (!confirmed || confirmed.id !== next.id || confirmed.status !== "shadow")
        throw new Error("PERSONAL_MODEL_ROTATION_UNCONFIRMED");
      return PersonalCompletionLearningStateSchema.parse({
        state: "retrained_shadow",
        retiredArtifactId: current.id,
        artifact: confirmed,
        previousHoldout: holdout,
      });
    }
    return PersonalCompletionLearningStateSchema.parse({
      state: "shadow_learning",
      artifact: current,
      holdout,
    });
  } catch {
    return { state: "unavailable" };
  }
}

export async function loadActivePersonalCompletionArtifact(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<PersonalCompletionArtifact | null> {
  return loadActiveArtifact(client, userId);
}
