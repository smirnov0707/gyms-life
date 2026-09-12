import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  governPersonalExperiment,
  PersonalExperimentProtocolSchema,
} from "./personal-experiment-governance";
import {
  PersonalExperimentLifecycleEventSchema,
  PersonalExperimentLifecycleStateSchema,
  nextPersonalExperimentState,
} from "./personal-experiment-lifecycle";
import {
  PersonalExperimentOutcomePhaseSchema,
  governanceFromRecord,
} from "./personal-experiment.persistence";

const CreateExperimentInput = PersonalExperimentProtocolSchema.omit({ id: true });
const TransitionExperimentInput = z.object({
  experimentId: z.string().uuid(),
  event: PersonalExperimentLifecycleEventSchema,
});
const AddOutcomeInput = z
  .object({
    experimentId: z.string().uuid(),
    observedAt: z.string().datetime({ offset: true }),
    phase: PersonalExperimentOutcomePhaseSchema,
    outcomeKey: z.string().trim().min(1).max(120),
    numericValue: z.number().finite().nullable().default(null),
    textValue: z.string().trim().min(1).max(240).nullable().default(null),
  })
  .refine((value) => value.numericValue !== null || value.textValue !== null);
function phaseAllowed(status: string, phase: z.infer<typeof PersonalExperimentOutcomePhaseSchema>) {
  if (phase === "baseline") return status === "draft" || status === "eligible";
  if (phase === "intervention") return status === "running";
  return status === "stopped" || status === "completed";
}

export const createPersonalExperiment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => CreateExperimentInput.parse(input))
  .handler(async ({ data, context }) => {
    const id = crypto.randomUUID();
    const protocol = PersonalExperimentProtocolSchema.parse({ id, ...data });
    const governance = governPersonalExperiment(protocol);
    const { error } = await context.supabase.from("personal_experiments").insert({
      id,
      user_id: context.userId,
      hypothesis_id: protocol.hypothesisId,
      domain: protocol.domain,
      intervention: protocol.intervention,
      primary_outcome: protocol.primaryOutcome,
      duration_days: protocol.durationDays,
      changed_variable_count: protocol.changedVariableCount,
      requires_medication_change: protocol.requiresMedicationChange,
      requires_supplement_escalation: protocol.requiresSupplementEscalation,
      requires_sleep_restriction: protocol.requiresSleepRestriction,
      requires_fasting_beyond_normal_routine: protocol.requiresFastingBeyondNormalRoutine,
      stop_conditions: protocol.stopConditions,
      governance,
      status: "draft",
    });
    if (error) throw new Error(`PERSONAL_EXPERIMENT_CREATE_FAILED:${error.code}`);
    return { id, governance, status: "draft" as const };
  });
export const transitionPersonalExperiment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => TransitionExperimentInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("personal_experiments")
      .select("status,governance,started_at,ended_at")
      .eq("id", data.experimentId)
      .eq("user_id", context.userId)
      .single();
    if (error || !row) throw new Error("PERSONAL_EXPERIMENT_NOT_FOUND");
    const governance = governanceFromRecord(row.governance);
    const current = PersonalExperimentLifecycleStateSchema.parse(row.status);
    const next = nextPersonalExperimentState({ state: current, event: data.event, governance });
    const terminal = next === "stopped" || next === "completed";
    const stopReason =
      data.event === "adverse_signal" || data.event === "protocol_deviation"
        ? data.event
        : data.event === "user_stop"
          ? "user_stopped"
          : null;
    const { error: updateError } = await context.supabase
      .from("personal_experiments")
      .update({
        status: next,
        started_at:
          next === "running" && !row.started_at ? new Date().toISOString() : row.started_at,
        ended_at: terminal ? new Date().toISOString() : row.ended_at,
        stop_reason: stopReason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.experimentId)
      .eq("user_id", context.userId);
    if (updateError) throw new Error(`PERSONAL_EXPERIMENT_TRANSITION_FAILED:${updateError.code}`);
    return { status: next };
  });
export const addPersonalExperimentOutcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => AddOutcomeInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: experiment, error } = await context.supabase
      .from("personal_experiments")
      .select("status")
      .eq("id", data.experimentId)
      .eq("user_id", context.userId)
      .single();
    if (error || !experiment) throw new Error("PERSONAL_EXPERIMENT_NOT_FOUND");
    if (!phaseAllowed(experiment.status, data.phase)) {
      throw new Error("PERSONAL_EXPERIMENT_OUTCOME_PHASE_INVALID");
    }
    const { error: insertError } = await context.supabase
      .from("personal_experiment_outcomes")
      .insert({
        experiment_id: data.experimentId,
        user_id: context.userId,
        observed_at: data.observedAt,
        phase: data.phase,
        outcome_key: data.outcomeKey,
        numeric_value: data.numericValue,
        text_value: data.textValue,
        source: "gymslife",
      });
    if (insertError) throw new Error(`PERSONAL_EXPERIMENT_OUTCOME_FAILED:${insertError.code}`);
    return { ok: true as const };
  });

export const listPersonalExperimentHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: experiments, error } = await context.supabase
      .from("personal_experiments")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(`PERSONAL_EXPERIMENT_LIST_FAILED:${error.code}`);
    const ids = (experiments ?? []).map((row) => row.id);
    if (ids.length === 0) return { experiments: [], outcomes: [] };
    const { data: outcomes, error: outcomesError } = await context.supabase
      .from("personal_experiment_outcomes")
      .select("*")
      .eq("user_id", context.userId)
      .in("experiment_id", ids)
      .order("observed_at", { ascending: true })
      .limit(500);
    if (outcomesError)
      throw new Error(`PERSONAL_EXPERIMENT_OUTCOMES_LIST_FAILED:${outcomesError.code}`);
    return { experiments: experiments ?? [], outcomes: outcomes ?? [] };
  });
