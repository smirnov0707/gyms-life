import { z } from "zod";
import { DataProvenanceSchema } from "./data-provenance.schema";

export const EvidenceLevelSchema = z.enum([
  "insufficient",
  "early",
  "moderate",
  "strong",
  "confirmed_for_now",
]);

export const UncertaintyLevelSchema = z.enum(["low", "moderate", "high", "unknown"]);

export const EvidenceMetricSchema = z.object({
  key: z.string().trim().min(1).max(80),
  value: z.number().finite(),
  unit: z.string().trim().min(1).max(24),
  source: DataProvenanceSchema,
}).strict();

export const EvidenceAssessmentSchema = z.object({
  level: EvidenceLevelSchema,
  sampleSize: z.number().int().nonnegative(),
  lastEvaluatedAt: z.string().nullable(),
  reasonKeys: z.array(z.string().trim().min(1).max(120)).max(12),
}).strict();

export const UncertaintySchema = z.object({
  level: UncertaintyLevelSchema,
  reasonKeys: z.array(z.string().trim().min(1).max(120)).max(12),
}).strict();

export type EvidenceMetric = z.infer<typeof EvidenceMetricSchema>;
export type EvidenceAssessment = z.infer<typeof EvidenceAssessmentSchema>;
export type Uncertainty = z.infer<typeof UncertaintySchema>;
