import {
  DecisionAccuracySchema,
  MINIMUM_ANSWERED_DECISIONS_FOR_RATE,
  type DecisionAccuracy,
} from "./decision-accuracy.schema";
import type { LabDecision } from "./lab.schema";
import type { TodayDecisionBasis } from "./today-decision.schema";

const ALL_BASES: TodayDecisionBasis[] = [
  "safety_rule",
  "current_day_fact",
  "current_checkin",
  "observed_pattern",
];

/** Accepted and completed mean the proposal fitted; the other two mean it did not. */
function isFitting(outcome: LabDecision["outcome"]): boolean {
  return outcome === "accepted" || outcome === "completed";
}

function isNotFitting(outcome: LabDecision["outcome"]): boolean {
  return outcome === "dismissed" || outcome === "not_helpful";
}

function rateFor(fitting: number, answered: number): number | null {
  if (answered < MINIMUM_ANSWERED_DECISIONS_FOR_RATE) return null;
  return Math.round((fitting / answered) * 100) / 100;
}

/**
 * Compares what the decision engine proposed against what the person
 * actually did about it, grouped by the basis the decision was made on.
 *
 * Deliberately conservative:
 * - A decision with no recorded outcome is not evidence of anything. It
 *   counts as proposed, never as a failure.
 * - A rate is withheld entirely below the minimum answered count rather
 *   than shown as a noisy fraction.
 * - A basis that has never been used is omitted, not shown as 0%.
 */
export function buildDecisionAccuracy(decisions: LabDecision[]): DecisionAccuracy {
  const byBasis = ALL_BASES.map((basis) => {
    const forBasis = decisions.filter((decision) => decision.basis === basis);
    const fitting = forBasis.filter((decision) => isFitting(decision.outcome)).length;
    const notFitting = forBasis.filter((decision) => isNotFitting(decision.outcome)).length;
    const answered = fitting + notFitting;
    return {
      basis,
      proposed: forBasis.length,
      answered,
      fitting,
      notFitting,
      fitRate: rateFor(fitting, answered),
    };
  }).filter((entry) => entry.proposed > 0);

  const totalFitting = decisions.filter((decision) => isFitting(decision.outcome)).length;
  const totalNotFitting = decisions.filter((decision) => isNotFitting(decision.outcome)).length;
  const totalAnswered = totalFitting + totalNotFitting;

  return DecisionAccuracySchema.parse({
    totalProposed: decisions.length,
    totalAnswered,
    totalFitting,
    overallFitRate: rateFor(totalFitting, totalAnswered),
    minimumAnswered: MINIMUM_ANSWERED_DECISIONS_FOR_RATE,
    byBasis,
  });
}
