import { z } from "zod";
import { TodayDecisionBasisSchema } from "./today-decision.schema";

/**
 * Minimum answered decisions before a fit rate is reported at all. Matches
 * the threshold the athlete state already uses for decision feedback, so
 * the same evidence bar applies wherever this signal appears.
 */
export const MINIMUM_ANSWERED_DECISIONS_FOR_RATE = 3;

/**
 * How often decisions made on one basis actually fitted the person's day.
 *
 * This is NOT prediction accuracy: the engine makes no numeric forecast, so
 * there is nothing to be right or wrong about in that sense. It measures
 * only whether a proposed action was taken up or turned down — and says
 * nothing about whether the training advice itself was physiologically
 * correct.
 */
export const DecisionBasisFitSchema = z
  .object({
    basis: TodayDecisionBasisSchema,
    proposed: z.number().int().nonnegative(),
    answered: z.number().int().nonnegative(),
    fitting: z.number().int().nonnegative(),
    notFitting: z.number().int().nonnegative(),
    /** Null until `answered` reaches the minimum: no rate is better than a noisy one. */
    fitRate: z.number().finite().min(0).max(1).nullable(),
  })
  .strict();

export type DecisionBasisFit = z.infer<typeof DecisionBasisFitSchema>;

export const DecisionAccuracySchema = z
  .object({
    totalProposed: z.number().int().nonnegative(),
    totalAnswered: z.number().int().nonnegative(),
    totalFitting: z.number().int().nonnegative(),
    overallFitRate: z.number().finite().min(0).max(1).nullable(),
    minimumAnswered: z.number().int().positive(),
    byBasis: z.array(DecisionBasisFitSchema),
  })
  .strict();

export type DecisionAccuracy = z.infer<typeof DecisionAccuracySchema>;
