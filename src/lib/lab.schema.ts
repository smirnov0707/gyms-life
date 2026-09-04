import { z } from "zod";
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
 * Lab v1: only what is real today. No experiments, predictions, or
 * discoveries engine exists yet — do not fabricate sections for them.
 */
export const LabOverviewSchema = z
  .object({
    hypotheses: z.array(AthleteHypothesisSchema),
    decisions: z.array(LabDecisionSchema),
    decisionAccuracy: DecisionAccuracySchema,
    dataGaps: z.array(DigitalAthleteDataGapSchema),
  })
  .strict();

export type LabOverview = z.infer<typeof LabOverviewSchema>;
