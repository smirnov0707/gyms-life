import { z } from "zod";

export const PersonalExperimentDomainSchema = z.enum([
  "training_behavior",
  "recovery_behavior",
  "nutrition_behavior",
]);

export const PersonalExperimentRiskSchema = z.enum(["low", "blocked"]);
export const PersonalExperimentStatusSchema = z.enum([
  "draft",
  "eligible",
  "running",
  "stopped",
  "completed",
]);

export const PersonalExperimentStopReasonSchema = z.enum([
  "user_stopped",
  "adverse_signal",
  "protocol_deviation",
  "insufficient_data",
]);

export const PersonalExperimentProtocolSchema = z
  .object({
    id: z.string().uuid(),
    hypothesisId: z.string().trim().min(1).max(120),
    domain: PersonalExperimentDomainSchema,
    intervention: z.string().trim().min(1).max(240),
    primaryOutcome: z.string().trim().min(1).max(120),
    durationDays: z.number().int().min(3).max(42),
    changedVariableCount: z.number().int().min(1).max(8),
    requiresMedicationChange: z.boolean(),
    requiresSupplementEscalation: z.boolean(),
    requiresSleepRestriction: z.boolean(),
    requiresFastingBeyondNormalRoutine: z.boolean(),
    stopConditions: z.array(z.string().trim().min(1).max(240)).min(1).max(12),
  })
  .strict();

export type PersonalExperimentProtocol = z.infer<typeof PersonalExperimentProtocolSchema>;
export const PersonalExperimentGovernanceSchema = z
  .object({
    risk: PersonalExperimentRiskSchema,
    eligibleToRun: z.boolean(),
    decisionAuthority: z.literal(false),
    causalClaimAllowed: z.literal(false),
    automaticPlanChangeAllowed: z.literal(false),
    blockers: z.array(z.string().trim().min(1).max(120)),
  })
  .strict();

export type PersonalExperimentGovernance = z.infer<typeof PersonalExperimentGovernanceSchema>;

export function governPersonalExperiment(
  protocol: PersonalExperimentProtocol,
): PersonalExperimentGovernance {
  const blockers: string[] = [];

  if (protocol.stopConditions.length === 0) blockers.push("missing_stop_conditions");
  if (protocol.changedVariableCount !== 1) blockers.push("multiple_changed_variables");
  if (protocol.requiresMedicationChange) blockers.push("medication_change_not_allowed");
  if (protocol.requiresSupplementEscalation) blockers.push("supplement_escalation_not_allowed");
  if (protocol.requiresSleepRestriction) blockers.push("sleep_restriction_not_allowed");
  if (protocol.requiresFastingBeyondNormalRoutine) blockers.push("extended_fasting_not_allowed");

  return PersonalExperimentGovernanceSchema.parse({
    risk: blockers.length === 0 ? "low" : "blocked",
    eligibleToRun: blockers.length === 0,
    decisionAuthority: false,
    causalClaimAllowed: false,
    automaticPlanChangeAllowed: false,
    blockers,
  });
}
