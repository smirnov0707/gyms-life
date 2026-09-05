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
}).strict().superRefine((value, context) => {
  if (value.occurredAt && value.recordedAt && Date.parse(value.recordedAt) < Date.parse(value.occurredAt)) {
    context.addIssue({
      code: "custom",
      message: "recordedAt must not precede occurredAt",
      path: ["recordedAt"],
    });
  }
});

export type IntelligenceProvenance = z.infer<typeof IntelligenceProvenanceSchema>;
export type TemporalEvidenceRef = z.infer<typeof TemporalEvidenceRefSchema>;
