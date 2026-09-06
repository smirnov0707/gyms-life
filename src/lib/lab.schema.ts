import { z } from "zod";
import { AthleteHypothesisLedgerSummarySchema } from "./athlete-hypothesis-ledger";
import { AthleteHypothesisSchema } from "./athlete-hypothesis.schema";
import { DecisionAccuracySchema } from "./decision-accuracy.schema";
import { DigitalAthleteDataGapSchema } from "./digital-athlete.schema";
import {
  TodayDecisionActionSchema,
  TodayDecisionBasisSchema,
  TodayDecisionEvidenceSchema,
  TodayDecisionOutcomeSchema,
  TodayDecisionStatusSchema,
} from "./today-decision.schema";

/**
 * One past Today decision as shown in the Lab journal: the same evidence
 * and basis the person saw at the time, plus what they actually did about
 * it (`outcome`, absent until they respond).
 */
export const LabDecisionSchema = z
  .object({
    id: z.string().uuid(),
    decisionOn: z.string().min(1),
    action: TodayDecisionActionSchema,
    basis: TodayDecisionBasisSchema,
    status: TodayDecisionStatusSchema,
    evidence: z.array(TodayDecisionEvidenceSchema),
    outcome: TodayDecisionOutcomeSchema.nullable(),
    createdAt: z.string().min(1),
  })
  .strict();

export type LabDecision = z.infer<typeof LabDecisionSchema>;

/**
 * One auditable hypothesis lifecycle point. The ledger summary is anchored to
 * the immutable athlete-state snapshot that produced the transition; occurredAt
 * records when GYMS.LIFE observed and persisted that epistemic state change.
 */
export const LabHypothesisTransitionSchema = AthleteHypothesisLedgerSummarySchema.extend({
  occurredAt: z.string().datetime({ offset: true }),
}).strict();

export type LabHypothesisTransition = z.infer<typeof LabHypothesisTransitionSchema>;

/**
 * Lab overview exposes current deterministic hypotheses, their bounded
 * longitudinal transition history, recent decisions, decision fit and data gaps.
 * Internal hypothesis history is an audit view only and is never Twin evidence.
 */
export const LabOverviewSchema = z
  .object({
    hypotheses: z.array(AthleteHypothesisSchema),
    hypothesisHistory: z.array(LabHypothesisTransitionSchema),
    decisions: z.array(LabDecisionSchema),
    decisionAccuracy: DecisionAccuracySchema,
    dataGaps: z.array(DigitalAthleteDataGapSchema),
  })
  .strict();

export type LabOverview = z.infer<typeof LabOverviewSchema>;
