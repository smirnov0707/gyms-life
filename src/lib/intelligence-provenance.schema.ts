import { z } from "zod";

/** Shared Future Lab vocabulary for where a value came from. */
export const IntelligenceProvenanceSchema = z.enum([
  "measured",
  "device_reported",
  "user_reported",
  "calculated",
  "inferred",
  "predicted",
  "simulated",
]);

export const TemporalEvidenceRefSchema = z.object({
  sourceType: z.string().trim().min(1).max(80),
  sourceId: z.string().trim().min(1).max(160).nullable(),
  provenance: IntelligenceProvenanceSchema,
  occurredAt: z.string().datetime({ offset: true }).nullable(),
  recordedAt: z.string().datetime({ offset: true }).nullable(),
  timezone: z.string().trim().min(1).max(80).nullable(),
  quality: z.enum(["unknown", "available", "partial", "degraded"]),
}).strict();

export type IntelligenceProvenance = z.infer<typeof IntelligenceProvenanceSchema>;
export type TemporalEvidenceRef = z.infer<typeof TemporalEvidenceRefSchema>;
