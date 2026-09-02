import { createHash } from "node:crypto";
import {
  ProposedTodayDecisionSchema,
  TodayDecisionInputSchema,
  type ProposedTodayDecision,
  type TodayDecisionEvidence,
  type TodayDecisionInput,
} from "./today-decision.schema";
import { loadModifierFor } from "./readiness.engine";

export const TODAY_DECISION_ENGINE_VERSION = "1.0" as const;

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
    input.hasActiveTrainingPlan ? "present" : "absent",
    "system_generated",
    position,
  );
}

function readinessEvidence(input: TodayDecisionInput, position: number): TodayDecisionEvidence {
  if (!input.hasCompletedReadinessToday || input.state.recovery.latestReadinessScore === null) {
    return evidence("today_readiness", "not_recorded", "system_generated", position);
  }

  return evidence(
    "today_readiness",
    String(input.state.recovery.latestReadinessScore),
    "user_reported",
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

/**
 * Chooses one conservative, explainable next action from validated facts.
 * This is deliberately deterministic: AI may explain the decision elsewhere,
 * but no provider decides training load or writes the athlete record.
 */
export function buildTodayDecision(value: TodayDecisionInput): ProposedTodayDecision {
  const input = TodayDecisionInputSchema.parse(value);
  const base = { engineVersion: TODAY_DECISION_ENGINE_VERSION, decisionOn: input.decisionOn };

  if (input.hasCompletedWorkoutToday) {
    return ProposedTodayDecisionSchema.parse({
      ...base,
      action: "log_nutrition",
      alternatives: ["recover"],
      confidence: 95,
      safetyConstraints: ["avoid_duplicate_training_prompt"],
      evidence: [
        evidence("completed_workout_today", "completed", "calculated", 0),
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
      evidence: [planEvidence(input, 0), dataQualityEvidence(input, 1)],
    });
  }

  if (!input.hasCompletedReadinessToday || input.state.recovery.latestReadinessScore === null) {
    return ProposedTodayDecisionSchema.parse({
      ...base,
      action: "complete_readiness",
      alternatives: ["recover"],
      confidence: 98,
      safetyConstraints: ["do_not_adapt_load_without_today_checkin"],
      evidence: [
        readinessEvidence(input, 0),
        planEvidence(input, 1),
        dataQualityEvidence(input, 2),
      ],
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
      evidence: [
        readinessEvidence(input, 0),
        loadModifierEvidence(input, 1),
        sessionsEvidence(input, 2),
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
      evidence: [
        readinessEvidence(input, 0),
        loadModifierEvidence(input, 1),
        sessionsEvidence(input, 2),
      ],
    });
  }

  return ProposedTodayDecisionSchema.parse({
    ...base,
    action: "train_as_planned",
    alternatives: ["recover"],
    confidence: qualityConfidence(input),
    safetyConstraints: ["apply_persisted_readiness_modifier"],
    evidence: [
      readinessEvidence(input, 0),
      loadModifierEvidence(input, 1),
      dataQualityEvidence(input, 2),
    ],
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
