import { z } from "zod";
import { TemporalEvidenceRefSchema } from "./intelligence-provenance.schema";

/**
 * Durable prediction contracts for Future Lab.
 * A prediction is a falsifiable claim about a future observable outcome,
 * distinct from an inference and from a simulated/counterfactual scenario.
 */
export const PredictionTargetSchema = z.enum([
  "workout_completion",
  "exercise_performance",
  "readiness",
  "short_term_fatigue",
]);
export const PredictionMaturitySchema = z.enum(["shadow", "canary", "production"]);
export const PredictionEvidenceLevelSchema = z.enum(["insufficient", "early", "moderate", "strong"]);

export const PredictionValueSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("boolean"), value: z.boolean() }).strict(),
  z.object({ kind: z.literal("probability"), value: z.number().min(0).max(1) }).strict(),
  z.object({ kind: z.literal("number"), value: z.number().finite(), unit: z.string().trim().min(1).max(32) }).strict(),
  z.object({ kind: z.literal("range"), low: z.number().finite(), high: z.number().finite(), unit: z.string().trim().min(1).max(32) }).strict().superRefine((value, context) => {
    if (value.low > value.high) context.addIssue({ code: "custom", message: "Prediction range low must not exceed high", path: ["low"] });
  }),
  z.object({ kind: z.literal("category"), value: z.string().trim().min(1).max(80) }).strict(),
]);

export const AthletePredictionSchema = z.object({
  id: z.string().uuid(),
  target: PredictionTargetSchema,
  generatedAt: z.string().datetime({ offset: true }),
  horizonEndsAt: z.string().datetime({ offset: true }),
  modelId: z.string().trim().min(1).max(120),
  modelVersion: z.string().trim().min(1).max(80),
  maturity: PredictionMaturitySchema,
  athleteStateSnapshotId: z.string().uuid().nullable(),
  evidenceLevel: PredictionEvidenceLevelSchema,
  evidence: z.array(TemporalEvidenceRefSchema).max(64),
  predicted: PredictionValueSchema,
  actual: PredictionValueSchema.nullable(),
  evaluatedAt: z.string().datetime({ offset: true }).nullable(),
}).strict().superRefine((value, context) => {
  if (Date.parse(value.horizonEndsAt) <= Date.parse(value.generatedAt)) context.addIssue({ code: "custom", message: "Prediction horizon must end after generation", path: ["horizonEndsAt"] });
  if (value.evaluatedAt && !value.actual) context.addIssue({ code: "custom", message: "An evaluated prediction requires an actual outcome", path: ["actual"] });
  if (value.actual && !value.evaluatedAt) context.addIssue({ code: "custom", message: "An actual outcome requires evaluatedAt", path: ["evaluatedAt"] });
  if (value.target === "workout_completion" && value.predicted.kind !== "probability") context.addIssue({ code: "custom", message: "Workout completion predictions must be probabilities", path: ["predicted"] });
  if (value.target === "workout_completion" && value.actual && value.actual.kind !== "boolean") context.addIssue({ code: "custom", message: "Workout completion actual outcomes must be boolean", path: ["actual"] });
});

export type PredictionTarget = z.infer<typeof PredictionTargetSchema>;
export type PredictionValue = z.infer<typeof PredictionValueSchema>;
export type AthletePrediction = z.infer<typeof AthletePredictionSchema>;

/** Future Me / What If is intentionally a different domain object. */
export const SimulationScenarioSchema = z.object({
  id: z.string().uuid(),
  generatedAt: z.string().datetime({ offset: true }),
  horizonEndsAt: z.string().datetime({ offset: true }),
  scenarioKey: z.string().trim().min(1).max(120),
  assumptions: z.array(z.string().trim().min(1).max(240)).min(1).max(32),
  modelId: z.string().trim().min(1).max(120),
  modelVersion: z.string().trim().min(1).max(80),
  outputs: z.record(z.string(), PredictionValueSchema),
  evidenceLevel: PredictionEvidenceLevelSchema,
}).strict().superRefine((value, context) => {
  if (Date.parse(value.horizonEndsAt) <= Date.parse(value.generatedAt)) context.addIssue({ code: "custom", message: "Simulation horizon must end after generation", path: ["horizonEndsAt"] });
});

export type SimulationScenario = z.infer<typeof SimulationScenarioSchema>;
