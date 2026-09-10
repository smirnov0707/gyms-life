import { z } from "zod";
import { IsoDaySchema } from "./local-day";

export const PERSONAL_COMPLETION_MODEL_ID = "workout-completion-personal-logit-offset" as const;
export const PERSONAL_COMPLETION_ALGORITHM_VERSION = "0.1.0" as const;
export const PERSONAL_COMPLETION_MIN_TRAINING_DAYS = 12;
export const PERSONAL_COMPLETION_MIN_HOLDOUT_DAYS = 20;
export const PERSONAL_COMPLETION_TRAINING_WINDOW_DAYS = 365;

export const PersonalCompletionParametersSchema = z
  .object({
    kind: z.literal("logit_offset_v1"),
    logOddsOffset: z.number().finite().min(-1.5).max(1.5),
    ridgePenalty: z.literal(4),
  })
  .strict();

export const PersonalCompletionArtifactSchema = z
  .object({
    id: z.string().uuid(),
    modelId: z.literal(PERSONAL_COMPLETION_MODEL_ID),
    algorithmVersion: z.literal(PERSONAL_COMPLETION_ALGORITHM_VERSION),
    sourceModelId: z.literal("workout-completion-usual-day-baseline"),
    sourceModelVersion: z.literal("0.1.0"),
    status: z.enum(["shadow", "qualified", "retired"]),
    trainingStartOn: IsoDaySchema,
    trainedThrough: IsoDaySchema,
    trainingDays: z
      .number()
      .int()
      .min(PERSONAL_COMPLETION_MIN_TRAINING_DAYS)
      .max(PERSONAL_COMPLETION_TRAINING_WINDOW_DAYS),
    positiveDays: z.number().int().min(1).max(3650),
    negativeDays: z.number().int().min(1).max(3650),
    evidenceFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    parameters: PersonalCompletionParametersSchema,
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.positiveDays + value.negativeDays !== value.trainingDays)
      ctx.addIssue({ code: "custom", message: "Training class counts must equal training days" });
    if (value.trainingStartOn > value.trainedThrough)
      ctx.addIssue({ code: "custom", message: "Training range is reversed" });
  });
export type PersonalCompletionArtifact = z.infer<typeof PersonalCompletionArtifactSchema>;

export const PersonalCompletionObservationSchema = z
  .object({
    decisionOn: IsoDaySchema,
    predictionId: z.string().uuid(),
    generatedAt: z.string().datetime({ offset: true }),
    baselineProbability: z.number().finite().min(0.001).max(0.999),
    actual: z.boolean(),
  })
  .strict();
export type PersonalCompletionObservation = z.infer<typeof PersonalCompletionObservationSchema>;

export const PersonalCompletionHoldoutSchema = z
  .object({
    pairedDays: z.number().int().min(0).max(3650),
    positiveDays: z.number().int().min(0).max(3650),
    negativeDays: z.number().int().min(0).max(3650),
    baselineBrier: z.number().finite().min(0).max(1).nullable(),
    challengerBrier: z.number().finite().min(0).max(1).nullable(),
    meanBrierImprovement: z.number().finite().min(-1).max(1).nullable(),
    improvementCi95Low: z.number().finite().min(-1).max(1).nullable(),
    baselineLogLoss: z.number().finite().min(0).max(20).nullable(),
    challengerLogLoss: z.number().finite().min(0).max(20).nullable(),
    baselineCalibrationGap: z.number().finite().min(0).max(1).nullable(),
    challengerCalibrationGap: z.number().finite().min(0).max(1).nullable(),
    minimumHoldoutDays: z.literal(PERSONAL_COMPLETION_MIN_HOLDOUT_DAYS),
    promotionEligible: z.boolean(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.positiveDays + value.negativeDays !== value.pairedDays)
      ctx.addIssue({ code: "custom", message: "Holdout class counts must equal paired days" });
    const metrics = [
      value.baselineBrier,
      value.challengerBrier,
      value.meanBrierImprovement,
      value.improvementCi95Low,
      value.baselineLogLoss,
      value.challengerLogLoss,
      value.baselineCalibrationGap,
      value.challengerCalibrationGap,
    ];
    if (
      (value.pairedDays < PERSONAL_COMPLETION_MIN_HOLDOUT_DAYS &&
        metrics.some((metric) => metric !== null)) ||
      (value.pairedDays >= PERSONAL_COMPLETION_MIN_HOLDOUT_DAYS &&
        metrics.some((metric) => metric === null))
    )
      ctx.addIssue({
        code: "custom",
        message: "Holdout metrics must be withheld below threshold and complete above it",
      });
    if (
      value.promotionEligible &&
      (value.pairedDays < PERSONAL_COMPLETION_MIN_HOLDOUT_DAYS ||
        value.positiveDays < 2 ||
        value.negativeDays < 2 ||
        value.improvementCi95Low === null ||
        value.improvementCi95Low <= 0)
    )
      ctx.addIssue({
        code: "custom",
        message: "Eligibility requires diverse forward evidence and positive paired improvement",
      });
  });
export type PersonalCompletionHoldout = z.infer<typeof PersonalCompletionHoldoutSchema>;

export const PersonalCompletionPredictionReviewSchema = z
  .object({
    checked: z.number().int().min(0).max(64),
    evaluated: z.number().int().min(0).max(64),
    limited: z.boolean(),
  })
  .strict()
  .refine(
    (value) => value.evaluated <= value.checked,
    "Evaluated predictions cannot exceed checked predictions",
  );
export type PersonalCompletionPredictionReview = z.infer<
  typeof PersonalCompletionPredictionReviewSchema
>;

export const PersonalCompletionLearningStateSchema = z
  .discriminatedUnion("state", [
    z
      .object({
        state: z.literal("insufficient_history"),
        evaluatedDays: z.number().int().min(0),
        minimumTrainingDays: z.literal(PERSONAL_COMPLETION_MIN_TRAINING_DAYS),
      })
      .strict(),
    z
      .object({
        state: z.literal("insufficient_variation"),
        evaluatedDays: z.number().int().min(PERSONAL_COMPLETION_MIN_TRAINING_DAYS),
        positiveDays: z.number().int().min(0),
        negativeDays: z.number().int().min(0),
      })
      .strict(),
    z
      .object({
        state: z.literal("trained_shadow"),
        artifact: PersonalCompletionArtifactSchema,
      })
      .strict(),
    z
      .object({
        state: z.literal("shadow_learning"),
        artifact: PersonalCompletionArtifactSchema,
        holdout: PersonalCompletionHoldoutSchema,
      })
      .strict(),
    z
      .object({
        state: z.literal("qualified_shadow"),
        artifact: PersonalCompletionArtifactSchema,
        holdout: PersonalCompletionHoldoutSchema,
      })
      .strict(),
    z
      .object({
        state: z.literal("retrained_shadow"),
        retiredArtifactId: z.string().uuid(),
        artifact: PersonalCompletionArtifactSchema,
        previousHoldout: PersonalCompletionHoldoutSchema,
      })
      .strict(),
    z.object({ state: z.literal("unavailable") }).strict(),
  ])
  .superRefine((value, ctx) => {
    if (value.state === "trained_shadow" && value.artifact.status !== "shadow")
      ctx.addIssue({ code: "custom", message: "Newly trained model must remain shadow" });
    if (value.state === "shadow_learning" && value.artifact.status !== "shadow")
      ctx.addIssue({ code: "custom", message: "Learning model must remain shadow" });
    if (value.state === "qualified_shadow" && value.artifact.status !== "qualified")
      ctx.addIssue({ code: "custom", message: "Qualified state requires qualified artifact" });
    if (
      value.state === "retrained_shadow" &&
      (value.artifact.status !== "shadow" || value.retiredArtifactId === value.artifact.id)
    )
      ctx.addIssue({
        code: "custom",
        message: "Retraining must replace a different retired artifact with shadow",
      });
  });
export type PersonalCompletionLearningState = z.infer<typeof PersonalCompletionLearningStateSchema>;
