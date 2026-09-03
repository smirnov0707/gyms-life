import type { DigitalAthleteState } from "./digital-athlete.schema";
import { AthleteDiscoverySchema, AthleteHypothesisSchema, type AthleteDiscovery, type AthleteHypothesis } from "./athlete-hypothesis.schema";
import { MIN_CONSECUTIVE_LOW_FEELINGS_FOR_GUARD, MIN_RATED_SESSIONS_FOR_TRAINING_RESPONSE_GUARD } from "./training-response.schema";

const MIN_USUAL_TRAINING_DAYS_FOR_BEHAVIOR_LEARNING = 8;
const STRONG_USUAL_DAY_COMPLETION_RATE = 0.8;

/** Builds auditable hypotheses from canonical athlete state. No LLM or causal claim is involved. */
export function buildAthleteHypotheses(state: DigitalAthleteState): AthleteHypothesis[] {
  const hypotheses: AthleteHypothesis[] = [];
  const response = state.training.selfReportedResponse;

  if (response.available) {
    const supported = response.ratedSessionsLast28Days >= MIN_RATED_SESSIONS_FOR_TRAINING_RESPONSE_GUARD && response.recentLowFeelingStreak >= MIN_CONSECUTIVE_LOW_FEELINGS_FOR_GUARD;
    hypotheses.push(AthleteHypothesisSchema.parse({
      id: "training-response-repeated-low-feeling", domain: "training_response",
      status: response.ratedSessionsLast28Days < MIN_RATED_SESSIONS_FOR_TRAINING_RESPONSE_GUARD ? "insufficient_evidence" : supported ? "supported" : "monitoring",
      statementKey: "athlete.hypothesis.trainingResponse.repeatedLowFeeling",
      evidence: [
        { key: "rated_sessions_28d", value: response.ratedSessionsLast28Days, unit: "sessions", source: "user_reported" },
        { key: "recent_low_feeling_streak", value: response.recentLowFeelingStreak, unit: "sessions", source: "user_reported" },
      ],
      evidenceCount: response.ratedSessionsLast28Days,
      minimumEvidenceCount: MIN_RATED_SESSIONS_FOR_TRAINING_RESPONSE_GUARD,
      canInfluenceDecision: supported,
    }));
  }

  if (state.behavior.status === "measured") {
    const enoughEvidence = state.behavior.usualTrainingDaysLast28Days >= MIN_USUAL_TRAINING_DAYS_FOR_BEHAVIOR_LEARNING;
    const supported = enoughEvidence && state.behavior.usualDayCompletionRateLast28Days >= STRONG_USUAL_DAY_COMPLETION_RATE;
    hypotheses.push(AthleteHypothesisSchema.parse({
      id: "training-behavior-usual-day-fit", domain: "training_behavior",
      status: !enoughEvidence ? "insufficient_evidence" : supported ? "supported" : "monitoring",
      statementKey: "athlete.hypothesis.trainingBehavior.usualDayFit",
      evidence: [
        { key: "usual_training_days_28d", value: state.behavior.usualTrainingDaysLast28Days, unit: "days", source: "calculated" },
        { key: "usual_day_completion_rate_28d", value: state.behavior.usualDayCompletionRateLast28Days, unit: "ratio", source: "calculated" },
      ],
      evidenceCount: state.behavior.usualTrainingDaysLast28Days,
      minimumEvidenceCount: MIN_USUAL_TRAINING_DAYS_FOR_BEHAVIOR_LEARNING,
      canInfluenceDecision: false,
    }));
  }
  return hypotheses;
}

export function buildAthleteDiscoveries(hypotheses: AthleteHypothesis[]): AthleteDiscovery[] {
  return hypotheses.flatMap((hypothesis) => hypothesis.status === "supported" && hypothesis.evidence.length > 0 ? [AthleteDiscoverySchema.parse({ hypothesisId: hypothesis.id, domain: hypothesis.domain, statementKey: hypothesis.statementKey, evidence: hypothesis.evidence, evidenceCount: hypothesis.evidenceCount, source: "deterministic" })] : []);
}
