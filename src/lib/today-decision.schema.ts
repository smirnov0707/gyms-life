import { z } from "zod";
import { DigitalAthleteStateSchema } from "./digital-athlete.schema";

const DaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const TodayDecisionEngineVersionSchema = z.enum(["1.0", "1.1"]);

export const TodayDecisionActionSchema = z.enum([
  "generate_training_plan",
  "complete_readiness",
  "recover",
  "train_adapted",
  "train_as_planned",
  "log_nutrition",
]);

export const TodayDecisionSafetyConstraintSchema = z.enum([
  "requires_active_plan_before_training",
  "do_not_adapt_load_without_today_checkin",
  "avoid_progression_when_readiness_low",
  "apply_persisted_readiness_modifier",
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
    decisionOn: DaySchema,
    hasActiveTrainingPlan: z.boolean(),
    hasCompletedReadinessToday: z.boolean(),
    hasCompletedWorkoutToday: z.boolean(),
    state: DigitalAthleteStateSchema,
  })
  .strict();

export const ProposedTodayDecisionSchema = z
  .object({
    engineVersion: z.literal("1.1"),
    decisionOn: DaySchema,
    action: TodayDecisionActionSchema,
    alternatives: z.array(TodayDecisionActionSchema).max(5),
    confidence: z.number().int().min(0).max(100),
    safetyConstraints: z.array(TodayDecisionSafetyConstraintSchema).max(5),
    evidence: z.array(TodayDecisionEvidenceSchema).min(1).max(4),
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
    confidence: z.number().int().min(0).max(100),
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
    confidence: z.number().int().min(0).max(100),
    safetyConstraints: z.array(TodayDecisionSafetyConstraintSchema),
    status: TodayDecisionStatusSchema,
    evidence: z.array(TodayDecisionEvidenceSchema).min(1).max(4),
    createdAt: z.string().min(1),
  })
  .strict();

export type TodayDecisionAction = z.infer<typeof TodayDecisionActionSchema>;
export type TodayDecisionEvidence = z.infer<typeof TodayDecisionEvidenceSchema>;
export type TodayDecisionInput = z.infer<typeof TodayDecisionInputSchema>;
export type ProposedTodayDecision = z.infer<typeof ProposedTodayDecisionSchema>;
export type TodayDecision = z.infer<typeof TodayDecisionSchema>;
export type TodayDecisionOutcome = z.infer<typeof TodayDecisionOutcomeSchema>;
