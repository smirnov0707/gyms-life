import { z } from "zod";
import {
  PersonalExperimentGovernanceSchema,
  PersonalExperimentProtocolSchema,
  PersonalExperimentStatusSchema,
  type PersonalExperimentGovernance,
  type PersonalExperimentProtocol,
} from "./personal-experiment-governance";

export const PersonalExperimentOutcomePhaseSchema = z.enum([
  "baseline",
  "intervention",
  "followup",
]);

export const PersonalExperimentRecordSchema = z
  .object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    protocol: PersonalExperimentProtocolSchema,
    governance: PersonalExperimentGovernanceSchema,
    status: PersonalExperimentStatusSchema,
    startedAt: z.string().datetime({ offset: true }).nullable(),
    endedAt: z.string().datetime({ offset: true }).nullable(),
    stopReason: z.string().nullable(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();
export type PersonalExperimentRecord = z.infer<typeof PersonalExperimentRecordSchema>;

export const PersonalExperimentOutcomeRecordSchema = z
  .object({
    id: z.string().uuid(),
    experimentId: z.string().uuid(),
    userId: z.string().uuid(),
    observedAt: z.string().datetime({ offset: true }),
    phase: PersonalExperimentOutcomePhaseSchema,
    outcomeKey: z.string().trim().min(1).max(120),
    numericValue: z.number().finite().nullable(),
    textValue: z.string().trim().min(1).max(240).nullable(),
    source: z.string().trim().min(1).max(80),
  })
  .strict()
  .refine((value) => value.numericValue !== null || value.textValue !== null, {
    message: "Experiment outcome requires a numeric or text value.",
  });

export type PersonalExperimentOutcomeRecord = z.infer<typeof PersonalExperimentOutcomeRecordSchema>;

export function experimentProtocolFromRecord(
  id: string,
  row: {
    hypothesis_id: string;
    domain: PersonalExperimentProtocol["domain"];
    intervention: string;
    primary_outcome: string;
    duration_days: number;
    changed_variable_count: number;
    requires_medication_change: boolean;
    requires_supplement_escalation: boolean;
    requires_sleep_restriction: boolean;
    requires_fasting_beyond_normal_routine: boolean;
    stop_conditions: unknown;
    governance: PersonalExperimentGovernance;
  },
): PersonalExperimentProtocol {
  return PersonalExperimentProtocolSchema.parse({
    id,
    hypothesisId: row.hypothesis_id,
    domain: row.domain,
    intervention: row.intervention,
    primaryOutcome: row.primary_outcome,
    durationDays: row.duration_days,
    changedVariableCount: row.changed_variable_count,
    requiresMedicationChange: row.requires_medication_change,
    requiresSupplementEscalation: row.requires_supplement_escalation,
    requiresSleepRestriction: row.requires_sleep_restriction,
    requiresFastingBeyondNormalRoutine: row.requires_fasting_beyond_normal_routine,
    stopConditions: z.array(z.string()).parse(row.stop_conditions),
  });
}

export function governanceFromRecord(value: unknown): PersonalExperimentGovernance {
  return PersonalExperimentGovernanceSchema.parse(value);
}
