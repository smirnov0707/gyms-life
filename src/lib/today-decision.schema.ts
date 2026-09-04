import { z } from "zod";
import { DigitalAthleteStateSchema } from "./digital-athlete.schema";

const DaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const TodayDecisionEngineVersionSchema = z.enum([
  "1.0",
  "1.1",
  "1.2",
  "1.3",
  "1.4",
  "1.5",
  "1.6",
  "1.7",
  "1.8",
  "1.9",
]);

export const TodayDecisionActionSchema = z.enum([
  "generate_training_plan",
  "complete_readiness",
  "recover",
  "train_adapted",
  "train_as_planned",
  "log_nutrition",
]);

/**
 * A deterministic Today decision is not a probability prediction. Its basis
 * tells the user which validated class of evidence determined the next step.
 */
export const TodayDecisionBasisSchema = z.enum([
  "safety_rule",
  "current_day_fact",
  "current_checkin",
  "observed_pattern",
]);

export const TodayDecisionSafetyConstraintSchema = z.enum([
  "requires_active_plan_before_training",
  "do_not_adapt_load_without_today_checkin",
  "avoid_progression_when_readiness_low",
  "apply_persisted_readiness_modifier",
  "apply_persisted_execution_snapshot",
  "apply_training_response_volume_guard",
  "avoid_duplicate_training_prompt",
  "avoid_training_with_active_limitation",
]);

export const TodayDecisionEvidenceKeySchema = z.enum([
  "active_training_plan",
  "today_readiness",
  "completed_workout_today",
  "sessions_last_7_days",
  "load_modifier",
  "model_data_quality",
  "active_life_context",
  "recent_decision_feedback",
  "training_rhythm",
  "recent_training_response",
]);

export const TodayDecisionEvidenceSourceSchema = z.enum([
  "user_reported",
  "calculated",
  "system_generated",
]);

export const TodayDecisionEvidenceSchema = z
  .object({
    key: TodayDecisionEvidenceKeySchema,
    value: z.string().trim().min(1).max(100),
    sourceClass: TodayDecisionEvidenceSourceSchema,
    position: z.number().int().min(0).max(10),
  })
  .strict();

export const TodayDecisionStatusSchema = z.enum([
  "active",
  "accepted",
  "dismissed",
  "completed",
  "expired",
]);

export const TodayDecisionOutcomeSchema = z.enum([
  "accepted",
  "dismissed",
  "completed",
  "not_helpful",
]);

export const TodayDecisionInputSchema = z
  .object({
    hasActiveTrainingPlan: z.boolean(),
    hasOpenWorkout: z.boolean(),
    activePlanDaysPerWeek: z.number().int().min(1).max(7).nullable(),
    activePlanSessionsLast7Days: z.number().int().nonnegative().nullable(),
    state: DigitalAthleteStateSchema,
  })
  .strict();

export const ProposedTodayDecisionSchema = z
  .object({
    engineVersion: z.literal("1.9"),
    decisionOn: DaySchema,
    action: TodayDecisionActionSchema,
    alternatives: z.array(TodayDecisionActionSchema).max(5),
    basis: TodayDecisionBasisSchema,
    safetyConstraints: z.array(TodayDecisionSafetyConstraintSchema).max(5),
    evidence: z.array(TodayDecisionEvidenceSchema).min(1).max(5),
  })
  .strict();

export const StoredTodayDecisionSchema = z
  .object({
    id: z.string().uuid(),
    athlete_state_snapshot_id: z.string().uuid(),
    decision_on: DaySchema,
    engine_version: TodayDecisionEngineVersionSchema,
    decision_fingerprint: Sha256Schema,
    action: TodayDecisionActionSchema,
    alternatives: z.array(TodayDecisionActionSchema),
    decision_basis: TodayDecisionBasisSchema,
    safety_constraints: z.array(TodayDecisionSafetyConstraintSchema),
    status: TodayDecisionStatusSchema,
    created_at: z.string().min(1),
  })
  .strict();

export const StoredTodayDecisionEvidenceSchema = z
  .object({
    evidence_key: TodayDecisionEvidenceKeySchema,
    evidence_value: z.string().trim().min(1).max(100),
    source_class: TodayDecisionEvidenceSourceSchema,
    position: z.number().int().min(0).max(10),
  })
  .strict();

export const TodayDecisionSchema = z
  .object({
    id: z.string().uuid(),
    snapshotId: z.string().uuid(),
    engineVersion: TodayDecisionEngineVersionSchema,
    decisionOn: DaySchema,
    action: TodayDecisionActionSchema,
    alternatives: z.array(TodayDecisionActionSchema),
    basis: TodayDecisionBasisSchema,
    safetyConstraints: z.array(TodayDecisionSafetyConstraintSchema),
    status: TodayDecisionStatusSchema,
    evidence: z.array(TodayDecisionEvidenceSchema).min(1).max(5),
    createdAt: z.string().min(1),
  })
  .strict();

/**
 * Structured Decision Ledger metadata (Future Lab Phase 1). These mirror
 * facts the engine already computes; none of them are a probabilistic
 * prediction. `prediction`/`uncertainty` stay unset until a real forecasting
 * model exists — writing them now would be exactly the fabricated confidence
 * this engine deliberately removed (see `decision_basis`).
 */
export const TodayDecisionModelVersionsSchema = z
  .object({ decisionEngine: TodayDecisionEngineVersionSchema })
  .strict();

export const TodayDecisionSafetyCheckSchema = z
  .object({
    constraintsApplied: z.array(TodayDecisionSafetyConstraintSchema).max(5),
    basis: TodayDecisionBasisSchema,
  })
  .strict();

export const TodayDecisionUserOverrideSchema = z
  .object({
    outcome: TodayDecisionOutcomeSchema,
    recordedAt: z.string().min(1),
  })
  .strict();

export type TodayDecisionModelVersions = z.infer<typeof TodayDecisionModelVersionsSchema>;
export type TodayDecisionSafetyCheck = z.infer<typeof TodayDecisionSafetyCheckSchema>;
export type TodayDecisionUserOverride = z.infer<typeof TodayDecisionUserOverrideSchema>;

export type TodayDecisionAction = z.infer<typeof TodayDecisionActionSchema>;
export type TodayDecisionBasis = z.infer<typeof TodayDecisionBasisSchema>;
export type TodayDecisionEvidence = z.infer<typeof TodayDecisionEvidenceSchema>;
export type TodayDecisionInput = z.infer<typeof TodayDecisionInputSchema>;
export type ProposedTodayDecision = z.infer<typeof ProposedTodayDecisionSchema>;
export type TodayDecision = z.infer<typeof TodayDecisionSchema>;
export type TodayDecisionOutcome = z.infer<typeof TodayDecisionOutcomeSchema>;
