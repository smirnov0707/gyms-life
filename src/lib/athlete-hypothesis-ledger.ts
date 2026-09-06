import { z } from "zod";
import {
  AthleteEvidenceMetricSchema,
  AthleteHypothesisStatusSchema,
  AthleteLearningDomainSchema,
  type AthleteHypothesis,
} from "./athlete-hypothesis.schema";

export const AthleteHypothesisLedgerSummarySchema = z
  .object({
    hypothesisId: z.string().trim().min(1).max(120),
    domain: AthleteLearningDomainSchema,
    previousStatus: AthleteHypothesisStatusSchema.nullable(),
    status: AthleteHypothesisStatusSchema,
    statementKey: z.string().trim().min(1).max(120),
    evidence: z.array(AthleteEvidenceMetricSchema).max(12),
    evidenceCount: z.number().int().nonnegative(),
    minimumEvidenceCount: z.number().int().positive(),
    canInfluenceDecision: z.boolean(),
    source: z.literal("deterministic"),
  })
  .strict();

export type AthleteHypothesisLedgerSummary = z.infer<
  typeof AthleteHypothesisLedgerSummarySchema
>;

/**
 * Returns the latest known ledger state for each hypothesis. Callers must
 * provide entries newest-first, matching the timeline query ordering.
 */
export function latestHypothesisLedgerState(
  entries: AthleteHypothesisLedgerSummary[],
): Map<string, AthleteHypothesisLedgerSummary> {
  const latest = new Map<string, AthleteHypothesisLedgerSummary>();
  for (const entry of entries) {
    if (!latest.has(entry.hypothesisId)) latest.set(entry.hypothesisId, entry);
  }
  return latest;
}

/**
 * Creates ledger rows only when a hypothesis is first observed or its status
 * changes. Evidence changes that do not alter status stay in the current
 * canonical athlete state and do not turn the timeline into a noisy snapshot log.
 */
export function buildHypothesisLedgerTransitions(
  hypotheses: AthleteHypothesis[],
  previousEntries: AthleteHypothesisLedgerSummary[],
): AthleteHypothesisLedgerSummary[] {
  const previousById = latestHypothesisLedgerState(previousEntries);

  return hypotheses.flatMap((hypothesis) => {
    const previous = previousById.get(hypothesis.id) ?? null;
    if (previous?.status === hypothesis.status) return [];

    return [
      AthleteHypothesisLedgerSummarySchema.parse({
        hypothesisId: hypothesis.id,
        domain: hypothesis.domain,
        previousStatus: previous?.status ?? null,
        status: hypothesis.status,
        statementKey: hypothesis.statementKey,
        evidence: hypothesis.evidence,
        evidenceCount: hypothesis.evidenceCount,
        minimumEvidenceCount: hypothesis.minimumEvidenceCount,
        canInfluenceDecision: hypothesis.canInfluenceDecision,
        source: "deterministic",
      }),
    ];
  });
}
