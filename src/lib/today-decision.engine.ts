import { createHash } from "node:crypto";
import {
  ProposedTodayDecisionSchema,
  TodayDecisionInputSchema,
  type ProposedTodayDecision,
  type TodayDecisionEvidence,
  type TodayDecisionInput,
} from "./today-decision.schema";
import { loadModifierFor } from "./readiness.engine";

// Versioned because the decision now consumes one canonical athlete-state
// snapshot rather than independently re-querying current-day facts.
export const TODAY_DECISION_ENGINE_VERSION = "1.7" as const;

function qualityConfidence(input: TodayDecisionInput): number {
  if (input.state.dataQuality.level === "informed") return 92;
  if (input.state.dataQuality.level === "building") return 85;
  return 75;
}

function evidence(
  key: TodayDecisionEvidence["key"],
  value: string,
  sourceClass: TodayDecisionEvidence["sourceClass"],
  position: number,
): TodayDecisionEvidence {
  return { key, value, sourceClass, position };
}

function dataQualityEvidence(input: TodayDecisionInput, position: number): TodayDecisionEvidence {
  return evidence("model_data_quality", input.state.dataQuality.level, "calculated", position);
}

function planEvidence(input: TodayDecisionInput, position: number): TodayDecisionEvidence {
  return evidence(
    "active_training_plan",
    input.hasActiveTrainingPlan ? (input.hasOpenWorkout ? "open_session" : "present") : "absent",
    "system_generated",
    position,
  );
}

function readinessEvidence(input: TodayDecisionInput, position: number): TodayDecisionEvidence {
  if (
    !input.state.currentDay.hasCompletedReadiness ||
    input.state.recovery.latestReadinessScore === null
  ) {
    return evidence("today_readiness", "not_recorded", "system_generated", position);
  }

  return evidence(
    "today_readiness",
    String(input.state.recovery.latestReadinessScore),
    "user_reported",
    position,
  );
}

function completedWorkoutEvidence(
  input: TodayDecisionInput,
  position: number,
): TodayDecisionEvidence {
  return evidence(
    "completed_workout_today",
    input.state.currentDay.hasLoggedNutrition ? "completed_and_nutrition_logged" : "completed",
    "calculated",
    position,
  );
}

function loadModifierEvidence(input: TodayDecisionInput, position: number): TodayDecisionEvidence {
  const score = input.state.recovery.latestReadinessScore;
  const modifier = score === null ? 1 : loadModifierFor(score);
  return evidence("load_modifier", modifier.toFixed(2), "calculated", position);
}

function sessionsEvidence(input: TodayDecisionInput, position: number): TodayDecisionEvidence {
  return evidence(
    "sessions_last_7_days",
    String(input.state.training.sessionsLast7Days),
    "calculated",
    position,
  );
}

function activePlanFrequencyEvidence(
  input: TodayDecisionInput,
  position: number,
): TodayDecisionEvidence {
  const sessions = input.activePlanSessionsLast7Days;
  const target = input.activePlanDaysPerWeek;
  if (sessions === null || target === null) return sessionsEvidence(input, position);
  return evidence("sessions_last_7_days", `${sessions}/${target}`, "calculated", position);
}

function hasReachedActivePlanFrequencyTarget(input: TodayDecisionInput): boolean {
  const sessions = input.activePlanSessionsLast7Days;
  const target = input.activePlanDaysPerWeek;
  return input.hasActiveTrainingPlan && sessions !== null && target !== null && sessions >= target;
}

function lifeContextEvidence(
  input: TodayDecisionInput,
  position: number,
): TodayDecisionEvidence | null {
  const contexts = input.state.currentContext.active.map((context) => context.context.kind);
  if (contexts.length === 0) return null;
  return evidence("active_life_context", contexts.join(","), "user_reported", position);
}

function withLifeContextEvidence(
  input: TodayDecisionInput,
  items: TodayDecisionEvidence[],
): TodayDecisionEvidence[] {
  const context = lifeContextEvidence(input, items.length);
  return context === null ? items : [...items, context];
}

function trainingRhythmEvidence(
  input: TodayDecisionInput,
  position: number,
): TodayDecisionEvidence | null {
  if (input.state.behavior.status !== "measured") return null;
  const isPreferredTrainingDay = input.state.behavior.preferredWeekdays.includes(
    input.state.currentDay.weekday,
  );
  return evidence(
    "training_rhythm",
    isPreferredTrainingDay ? "usual_training_day" : "usual_recovery_day",
    "user_reported",
    position,
  );
}

function withTrainingRhythmEvidence(
  input: TodayDecisionInput,
  items: TodayDecisionEvidence[],
): TodayDecisionEvidence[] {
  const rhythm = trainingRhythmEvidence(input, items.length);
  return rhythm === null ? items : [...items, rhythm];
}

function decisionFeedbackEvidence(
  input: TodayDecisionInput,
  position: number,
): TodayDecisionEvidence | null {
  const feedback = input.state.decisionFeedback;
  if (feedback.helpfulnessRate === null) return null;
  return evidence(
    "recent_decision_feedback",
    `${feedback.helpfulDecisionOutcomesLast28Days}/${feedback.ratedDecisionsLast28Days}`,
    "calculated",
    position,
  );
}

function withDecisionFeedbackEvidence(
  input: TodayDecisionInput,
  items: TodayDecisionEvidence[],
): TodayDecisionEvidence[] {
  // A decision record deliberately stays compact. When all five evidence
  // slots are already occupied by facts that determine today's action, the
  // historical feedback signal remains available for confidence calibration
  // but is not persisted as a sixth explanation item.
  if (items.length >= 5) return items;
  const feedback = decisionFeedbackEvidence(input, items.length);
  return feedback === null ? items : [...items, feedback];
}

/**
 * Feedback can reduce the confidence label only after enough explicit user
 * outcomes exist. It never upgrades confidence, changes the chosen action,
 * or weakens a safety constraint.
 */
function calibratedConfidence(input: TodayDecisionInput, baseConfidence: number): number {
  const helpfulnessRate = input.state.decisionFeedback.helpfulnessRate;
  if (helpfulnessRate === null) return baseConfidence;
  if (helpfulnessRate < 0.5) return Math.max(baseConfidence - 15, 60);
  if (helpfulnessRate < 0.7) return Math.max(baseConfidence - 8, 65);
  return baseConfidence;
}

/**
 * Chooses one conservative, explainable next action from validated facts.
 * This is deliberately deterministic: AI may explain the decision elsewhere,
 * but no provider decides training load or writes the athlete record.
 */
export function buildTodayDecision(value: TodayDecisionInput): ProposedTodayDecision {
  const input = TodayDecisionInputSchema.parse(value);
  const base = {
    engineVersion: TODAY_DECISION_ENGINE_VERSION,
    decisionOn: input.state.currentDay.day,
  };

  if (input.state.currentDay.hasCompletedWorkout) {
    if (input.state.currentDay.hasLoggedNutrition) {
      return ProposedTodayDecisionSchema.parse({
        ...base,
        action: "recover",
        alternatives: ["log_nutrition"],
        confidence: 95,
        safetyConstraints: ["avoid_duplicate_training_prompt"],
        evidence: [
          completedWorkoutEvidence(input, 0),
          sessionsEvidence(input, 1),
          dataQualityEvidence(input, 2),
        ],
      });
    }

    return ProposedTodayDecisionSchema.parse({
      ...base,
      action: "log_nutrition",
      alternatives: ["recover"],
      confidence: 95,
      safetyConstraints: ["avoid_duplicate_training_prompt"],
      evidence: [
        completedWorkoutEvidence(input, 0),
        sessionsEvidence(input, 1),
        dataQualityEvidence(input, 2),
      ],
    });
  }

  if (input.state.currentContext.hasSafetyConstraint) {
    return ProposedTodayDecisionSchema.parse({
      ...base,
      action: "recover",
      alternatives: ["complete_readiness"],
      confidence: 96,
      safetyConstraints: ["avoid_training_with_active_limitation"],
      evidence: [
        evidence("active_life_context", "temporary_limitation", "user_reported", 0),
        sessionsEvidence(input, 1),
        dataQualityEvidence(input, 2),
      ],
    });
  }

  if (!input.hasActiveTrainingPlan) {
    return ProposedTodayDecisionSchema.parse({
      ...base,
      action: "generate_training_plan",
      alternatives: ["complete_readiness"],
      confidence: 100,
      safetyConstraints: ["requires_active_plan_before_training"],
      evidence: withLifeContextEvidence(input, [
        planEvidence(input, 0),
        dataQualityEvidence(input, 1),
      ]),
    });
  }

  if (input.hasOpenWorkout) {
    return ProposedTodayDecisionSchema.parse({
      ...base,
      action: "train_as_planned",
      alternatives: ["recover"],
      confidence: 98,
      safetyConstraints: ["apply_persisted_execution_snapshot"],
      evidence: withLifeContextEvidence(input, [
        planEvidence(input, 0),
        sessionsEvidence(input, 1),
        dataQualityEvidence(input, 2),
      ]),
    });
  }

  if (hasReachedActivePlanFrequencyTarget(input)) {
    return ProposedTodayDecisionSchema.parse({
      ...base,
      action: "recover",
      alternatives: ["complete_readiness"],
      confidence: 95,
      safetyConstraints: [],
      evidence: withLifeContextEvidence(input, [
        activePlanFrequencyEvidence(input, 0),
        planEvidence(input, 1),
        dataQualityEvidence(input, 2),
      ]),
    });
  }

  if (
    !input.state.currentDay.hasCompletedReadiness ||
    input.state.recovery.latestReadinessScore === null
  ) {
    return ProposedTodayDecisionSchema.parse({
      ...base,
      action: "complete_readiness",
      alternatives: ["recover"],
      confidence: 98,
      safetyConstraints: ["do_not_adapt_load_without_today_checkin"],
      evidence: withTrainingRhythmEvidence(
        input,
        withLifeContextEvidence(input, [
          readinessEvidence(input, 0),
          planEvidence(input, 1),
          dataQualityEvidence(input, 2),
        ]),
      ),
    });
  }

  const score = input.state.recovery.latestReadinessScore;
  if (score < 55) {
    return ProposedTodayDecisionSchema.parse({
      ...base,
      action: "recover",
      alternatives: ["train_adapted"],
      confidence: 95,
      safetyConstraints: ["avoid_progression_when_readiness_low"],
      evidence: withLifeContextEvidence(input, [
        readinessEvidence(input, 0),
        loadModifierEvidence(input, 1),
        sessionsEvidence(input, 2),
      ]),
    });
  }

  const hasExecutableLifeConstraint = input.state.currentContext.active.some(
    (context) =>
      context.context.kind === "travel" ||
      context.context.kind === "time_limited" ||
      context.context.kind === "equipment_limited" ||
      context.context.kind === "facility_closed" ||
      context.context.kind === "high_stress",
  );
  if (hasExecutableLifeConstraint) {
    return ProposedTodayDecisionSchema.parse({
      ...base,
      action: "train_adapted",
      alternatives: ["recover", "train_as_planned"],
      confidence: calibratedConfidence(input, Math.min(qualityConfidence(input), 92)),
      safetyConstraints: [
        "apply_persisted_readiness_modifier",
        "apply_persisted_execution_snapshot",
      ],
      evidence: withDecisionFeedbackEvidence(
        input,
        withTrainingRhythmEvidence(
          input,
          withLifeContextEvidence(input, [
            readinessEvidence(input, 0),
            loadModifierEvidence(input, 1),
            dataQualityEvidence(input, 2),
          ]),
        ),
      ),
    });
  }

  if (
    input.state.behavior.status === "measured" &&
    !input.state.behavior.preferredWeekdays.includes(input.state.currentDay.weekday)
  ) {
    return ProposedTodayDecisionSchema.parse({
      ...base,
      action: "recover",
      alternatives: [score < 70 ? "train_adapted" : "train_as_planned"],
      confidence: calibratedConfidence(input, Math.min(qualityConfidence(input), 88)),
      safetyConstraints: [],
      evidence: [
        evidence("training_rhythm", "usual_recovery_day", "user_reported", 0),
        readinessEvidence(input, 1),
        loadModifierEvidence(input, 2),
        activePlanFrequencyEvidence(input, 3),
        dataQualityEvidence(input, 4),
      ],
    });
  }

  if (score < 70) {
    return ProposedTodayDecisionSchema.parse({
      ...base,
      action: "train_adapted",
      alternatives: ["recover"],
      confidence: 92,
      safetyConstraints: ["apply_persisted_readiness_modifier"],
      evidence: withTrainingRhythmEvidence(
        input,
        withLifeContextEvidence(input, [
          readinessEvidence(input, 0),
          loadModifierEvidence(input, 1),
          sessionsEvidence(input, 2),
        ]),
      ),
    });
  }

  return ProposedTodayDecisionSchema.parse({
    ...base,
    action: "train_as_planned",
    alternatives: ["recover"],
    confidence: calibratedConfidence(input, qualityConfidence(input)),
    safetyConstraints: ["apply_persisted_readiness_modifier"],
    evidence: withDecisionFeedbackEvidence(
      input,
      withTrainingRhythmEvidence(
        input,
        withLifeContextEvidence(input, [
          readinessEvidence(input, 0),
          loadModifierEvidence(input, 1),
          dataQualityEvidence(input, 2),
        ]),
      ),
    ),
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) throw new Error("Today decision is not serializable.");
    return serialized;
  }
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  throw new Error("Today decision is not serializable.");
}

/** A change in actionable facts creates a new auditable decision. */
export function fingerprintTodayDecision(
  decision: ProposedTodayDecision,
  athleteStateSnapshotId: string,
): string {
  return createHash("sha256")
    .update(stableJson({ athleteStateSnapshotId, decision }))
    .digest("hex");
}
