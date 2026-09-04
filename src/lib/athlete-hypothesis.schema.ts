import { z } from "zod";
import { EvidenceMetricSchema } from "./evidence.schema";

export const AthleteLearningDomainSchema = z.enum(["training_response", "training_behavior", "recovery", "nutrition", "performance"]);
export const AthleteHypothesisStatusSchema = z.enum(["insufficient_evidence", "monitoring", "supported", "contradicted"]);

/** @deprecated Use the canonical EvidenceMetricSchema. Kept as an alias during the brownfield migration. */
export const AthleteEvidenceMetricSchema = EvidenceMetricSchema;

export const AthleteHypothesisSchema = z.object({
  id: z.string().trim().min(1).max(120),
  domain: AthleteLearningDomainSchema,
  status: AthleteHypothesisStatusSchema,
  statementKey: z.string().trim().min(1).max(120),
  evidence: z.array(AthleteEvidenceMetricSchema).max(12),
  evidenceCount: z.number().int().nonnegative(),
  minimumEvidenceCount: z.number().int().positive(),
  canInfluenceDecision: z.boolean(),
}).strict().superRefine((value, context) => {
  if (value.status === "supported" && value.evidenceCount < value.minimumEvidenceCount) context.addIssue({ code: "custom", message: "Supported hypotheses require enough evidence.", path: ["evidenceCount"] });
  if (value.canInfluenceDecision && value.status !== "supported") context.addIssue({ code: "custom", message: "Only supported hypotheses may influence decisions.", path: ["canInfluenceDecision"] });
});

export type AthleteHypothesis = z.infer<typeof AthleteHypothesisSchema>;

export const AthleteDiscoverySchema = z.object({
  hypothesisId: z.string().trim().min(1).max(120),
  domain: AthleteLearningDomainSchema,
  statementKey: z.string().trim().min(1).max(120),
  evidence: z.array(AthleteEvidenceMetricSchema).min(1).max(12),
  evidenceCount: z.number().int().positive(),
  source: z.literal("deterministic"),
}).strict();

export type AthleteDiscovery = z.infer<typeof AthleteDiscoverySchema>;
