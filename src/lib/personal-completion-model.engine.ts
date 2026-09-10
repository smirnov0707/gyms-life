import { createHash, randomUUID } from "node:crypto";
import { AthletePredictionSchema, type AthletePrediction } from "./prediction.schema";
import { IntelligenceModelDescriptorSchema } from "./model-registry.schema";
import {
  PERSONAL_COMPLETION_ALGORITHM_VERSION,
  PERSONAL_COMPLETION_MIN_HOLDOUT_DAYS,
  PERSONAL_COMPLETION_MIN_TRAINING_DAYS,
  PERSONAL_COMPLETION_MODEL_ID,
  PersonalCompletionArtifactSchema,
  PersonalCompletionHoldoutSchema,
  PersonalCompletionObservationSchema,
  type PersonalCompletionArtifact,
  type PersonalCompletionHoldout,
  type PersonalCompletionObservation,
} from "./personal-completion-model.schema";

export const PERSONAL_COMPLETION_MODEL = IntelligenceModelDescriptorSchema.parse({
  modelId: PERSONAL_COMPLETION_MODEL_ID,
  version: PERSONAL_COMPLETION_ALGORITHM_VERSION,
  type: "statistical",
  status: "shadow",
  targets: ["workout_completion"],
  inputContractVersion: "evaluated-baseline-1",
  outputContractVersion: "prediction-1",
  description:
    "Per-athlete ridge-regularized log-odds calibration of the transparent completion baseline; shadow-only until forward holdout qualification.",
});

const EPSILON = 0.001;
const RIDGE = 4 as const;

function clampProbability(value: number): number {
  return Math.min(1 - EPSILON, Math.max(EPSILON, value));
}
function logit(value: number): number {
  const p = clampProbability(value);
  return Math.log(p / (1 - p));
}
function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}
function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
function uniqueChronological(
  observations: PersonalCompletionObservation[],
): PersonalCompletionObservation[] {
  const byDay = new Map<string, PersonalCompletionObservation>();
  for (const raw of observations) {
    const item = PersonalCompletionObservationSchema.parse(raw);
    const previous = byDay.get(item.decisionOn);
    if (!previous || Date.parse(item.generatedAt) < Date.parse(previous.generatedAt)) {
      byDay.set(item.decisionOn, item);
    }
  }
  return [...byDay.values()].sort(
    (a, b) =>
      a.decisionOn.localeCompare(b.decisionOn) ||
      Date.parse(a.generatedAt) - Date.parse(b.generatedAt),
  );
}

export function summarizePersonalCompletionTraining(observations: PersonalCompletionObservation[]) {
  const days = uniqueChronological(observations);
  const positiveDays = days.filter((item) => item.actual).length;
  return {
    days,
    evaluatedDays: days.length,
    positiveDays,
    negativeDays: days.length - positiveDays,
  };
}

/**
 * One-parameter personal calibrator. It cannot invent physiology: it only
 * learns whether this athlete systematically completes more/less often than
 * the existing baseline probability suggests.
 */
export function fitPersonalCompletionArtifact(
  observations: PersonalCompletionObservation[],
  createdAt = new Date().toISOString(),
  artifactId = randomUUID(),
): PersonalCompletionArtifact | null {
  const summary = summarizePersonalCompletionTraining(observations);
  const days = summary.days;
  if (days.length < PERSONAL_COMPLETION_MIN_TRAINING_DAYS) return null;
  const positives = summary.positiveDays;
  const negatives = summary.negativeDays;
  if (positives < 1 || negatives < 1) return null;
  let offset = 0;
  for (let iteration = 0; iteration < 30; iteration++) {
    let gradient = RIDGE * offset;
    let hessian = RIDGE;
    for (const item of days) {
      const probability = sigmoid(logit(item.baselineProbability) + offset);
      gradient += probability - (item.actual ? 1 : 0);
      hessian += probability * (1 - probability);
    }
    const next = Math.max(-1.5, Math.min(1.5, offset - gradient / Math.max(0.001, hessian)));
    if (Math.abs(next - offset) < 1e-8) {
      offset = next;
      break;
    }
    offset = next;
  }
  const evidenceFingerprint = createHash("sha256")
    .update(
      days
        .map(
          (item) =>
            `${item.decisionOn}:${item.predictionId}:${item.generatedAt}:${item.baselineProbability.toFixed(6)}:${item.actual ? 1 : 0}`,
        )
        .join("|"),
    )
    .digest("hex");
  return PersonalCompletionArtifactSchema.parse({
    id: artifactId,
    modelId: PERSONAL_COMPLETION_MODEL_ID,
    algorithmVersion: PERSONAL_COMPLETION_ALGORITHM_VERSION,
    sourceModelId: "workout-completion-usual-day-baseline",
    sourceModelVersion: "0.1.0",
    status: "shadow",
    trainingStartOn: days[0]!.decisionOn,
    trainedThrough: days.at(-1)!.decisionOn,
    trainingDays: days.length,
    positiveDays: positives,
    negativeDays: negatives,
    evidenceFingerprint,
    parameters: { kind: "logit_offset_v1", logOddsOffset: round(offset), ridgePenalty: RIDGE },
    createdAt,
  });
}
export function personalCompletionPredictionId(artifactId: string, decisionId: string): string {
  const hex = createHash("sha256")
    .update(`${artifactId}:${decisionId}`)
    .digest("hex")
    .slice(0, 32)
    .split("");
  hex[12] = "5";
  hex[16] = "8";
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

export function personalCompletionProbability(
  artifact: PersonalCompletionArtifact,
  baselineProbability: number,
): number {
  const parsed = PersonalCompletionArtifactSchema.parse(artifact);
  return round(
    clampProbability(sigmoid(logit(baselineProbability) + parsed.parameters.logOddsOffset)),
  );
}

export function buildPersonalCompletionShadowPrediction(input: {
  artifact: PersonalCompletionArtifact;
  baseline: AthletePrediction;
  decisionOn: string;
  predictionId?: string;
}): AthletePrediction | null {
  const artifact = PersonalCompletionArtifactSchema.parse(input.artifact);
  const baseline = AthletePredictionSchema.parse(input.baseline);
  if (artifact.status !== "shadow") return null;
  if (input.decisionOn <= artifact.trainedThrough) return null;
  if (
    baseline.target !== "workout_completion" ||
    baseline.modelId !== artifact.sourceModelId ||
    baseline.modelVersion !== artifact.sourceModelVersion ||
    baseline.predicted.kind !== "probability" ||
    baseline.actual !== null ||
    baseline.evaluatedAt !== null
  )
    return null;
  return AthletePredictionSchema.parse({
    ...baseline,
    id: input.predictionId ?? randomUUID(),
    modelId: artifact.modelId,
    modelVersion: `${artifact.algorithmVersion}+${artifact.id.slice(0, 8)}`,
    predicted: {
      kind: "probability",
      value: personalCompletionProbability(artifact, baseline.predicted.value),
    },
  });
}
type HoldoutPair = {
  decisionOn: string;
  actual: boolean;
  baselineProbability: number;
  challengerProbability: number;
};

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
function logLoss(probability: number, actual: boolean): number {
  const p = clampProbability(probability);
  return -(actual ? Math.log(p) : Math.log(1 - p));
}

export function evaluatePersonalCompletionHoldout(
  rawPairs: HoldoutPair[],
): PersonalCompletionHoldout {
  const byDay = new Map<string, HoldoutPair>();
  for (const pair of rawPairs) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pair.decisionOn)) continue;
    if (!Number.isFinite(pair.baselineProbability) || !Number.isFinite(pair.challengerProbability))
      continue;
    if (byDay.has(pair.decisionOn)) continue;
    byDay.set(pair.decisionOn, {
      ...pair,
      baselineProbability: clampProbability(pair.baselineProbability),
      challengerProbability: clampProbability(pair.challengerProbability),
    });
  }
  const ordered = [...byDay.values()].sort((a, b) => a.decisionOn.localeCompare(b.decisionOn));
  // The forward protocol is predeclared: once 20 distinct days exist, only
  // those first 20 may decide this artifact's qualification. Later outcomes
  // belong to a future artifact, not to a retrospective rescue of this one.
  const pairs =
    ordered.length >= PERSONAL_COMPLETION_MIN_HOLDOUT_DAYS
      ? ordered.slice(0, PERSONAL_COMPLETION_MIN_HOLDOUT_DAYS)
      : ordered;
  const positives = pairs.filter((pair) => pair.actual).length;
  const negatives = pairs.length - positives;
  if (pairs.length < PERSONAL_COMPLETION_MIN_HOLDOUT_DAYS) {
    return PersonalCompletionHoldoutSchema.parse({
      pairedDays: pairs.length,
      positiveDays: positives,
      negativeDays: negatives,
      baselineBrier: null,
      challengerBrier: null,
      meanBrierImprovement: null,
      improvementCi95Low: null,
      baselineLogLoss: null,
      challengerLogLoss: null,
      baselineCalibrationGap: null,
      challengerCalibrationGap: null,
      minimumHoldoutDays: PERSONAL_COMPLETION_MIN_HOLDOUT_DAYS,
      promotionEligible: false,
    });
  }
  const baselineErrors = pairs.map((pair) => {
    const actual = pair.actual ? 1 : 0;
    return (pair.baselineProbability - actual) ** 2;
  });
  const challengerErrors = pairs.map((pair) => {
    const actual = pair.actual ? 1 : 0;
    return (pair.challengerProbability - actual) ** 2;
  });
  const improvements = baselineErrors.map((value, index) => value - challengerErrors[index]!);
  const averageImprovement = mean(improvements);
  const variance =
    improvements.length > 1
      ? improvements.reduce((sum, value) => sum + (value - averageImprovement) ** 2, 0) /
        (improvements.length - 1)
      : 0;
  const standardError = Math.sqrt(variance / improvements.length);
  const ciLow = averageImprovement - 1.96 * standardError;
  const observedRate = positives / pairs.length;
  const baselineMean = mean(pairs.map((pair) => pair.baselineProbability));
  const challengerMean = mean(pairs.map((pair) => pair.challengerProbability));
  const baselineLL = mean(pairs.map((pair) => logLoss(pair.baselineProbability, pair.actual)));
  const challengerLL = mean(pairs.map((pair) => logLoss(pair.challengerProbability, pair.actual)));
  const promotionEligible =
    positives >= 2 &&
    negatives >= 2 &&
    ciLow > 0 &&
    challengerLL < baselineLL &&
    Math.abs(challengerMean - observedRate) <= Math.abs(baselineMean - observedRate) + 0.02;
  return PersonalCompletionHoldoutSchema.parse({
    pairedDays: pairs.length,
    positiveDays: positives,
    negativeDays: negatives,
    baselineBrier: round(mean(baselineErrors)),
    challengerBrier: round(mean(challengerErrors)),
    meanBrierImprovement: round(averageImprovement),
    improvementCi95Low: round(ciLow),
    baselineLogLoss: round(baselineLL),
    challengerLogLoss: round(challengerLL),
    baselineCalibrationGap: round(Math.abs(baselineMean - observedRate)),
    challengerCalibrationGap: round(Math.abs(challengerMean - observedRate)),
    minimumHoldoutDays: PERSONAL_COMPLETION_MIN_HOLDOUT_DAYS,
    promotionEligible,
  });
}
