import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  CalculatedMemoryCandidateSchema,
  type CalculatedMemoryCandidate,
} from "./calculated-memory.contract";
import { DigitalAthleteStateSchema, type DigitalAthleteState } from "./digital-athlete.schema";

type AthleteStateSnapshotReference = {
  id: string;
  schemaVersion: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Converts validated domain values to the generated Supabase Json contract without casts. */
function toJson(value: unknown): Json {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) return value.map(toJson);
  if (isRecord(value)) {
    const output: { [key: string]: Json | undefined } = {};
    for (const [key, nestedValue] of Object.entries(value)) output[key] = toJson(nestedValue);
    return output;
  }
  throw new Error("Calculated memory contains a non-JSON value.");
}

/**
 * Emits only claims directly supported by enough deterministic source data.
 * It intentionally does not infer causality, predictions, or medical meaning.
 */
export function buildCalculatedMemoryCandidates(
  value: DigitalAthleteState,
): CalculatedMemoryCandidate[] {
  const state = DigitalAthleteStateSchema.parse(value);
  const candidates: CalculatedMemoryCandidate[] = [];

  if (state.training.sessionsLast28Days >= 8) {
    candidates.push({
      memoryKey: "derived:training_consistency_28d",
      memoryType: "training_pattern",
      content: `Completed ${state.training.sessionsLast28Days} workouts in the last 28 days.`,
      value: {
        kind: "training_consistency_28d",
        sessionsLast28Days: state.training.sessionsLast28Days,
        windowDays: 28,
      },
      confidence: 0.85,
      importance: 0.7,
    });
  }

  if (state.behavior.status === "measured" && state.behavior.usualTrainingDaysLast28Days >= 4) {
    candidates.push({
      memoryKey: "derived:training_rhythm_observation_28d",
      memoryType: "behavior",
      content: `Completed a workout on ${state.behavior.completedUsualTrainingDaysLast28Days} of ${state.behavior.usualTrainingDaysLast28Days} user-stated usual training days across the previous 28 complete days.`,
      value: {
        kind: "training_rhythm_observation_28d",
        usualTrainingDaysLast28Days: state.behavior.usualTrainingDaysLast28Days,
        completedUsualTrainingDaysLast28Days: state.behavior.completedUsualTrainingDaysLast28Days,
        completedFlexibleTrainingDaysLast28Days:
          state.behavior.completedFlexibleTrainingDaysLast28Days,
        usualDayCompletionRateLast28Days: state.behavior.usualDayCompletionRateLast28Days,
        windowDays: 28,
      },
      confidence: state.behavior.usualTrainingDaysLast28Days >= 8 ? 0.8 : 0.65,
      importance: 0.7,
    });
  }

  if (
    state.recovery.checkinsLast7Days >= 3 &&
    state.recovery.averageReadinessLast7Days !== null &&
    state.recovery.averageReadinessLast7Days < 55
  ) {
    candidates.push({
      memoryKey: "derived:recovery_low_7d",
      memoryType: "recovery_pattern",
      content: `Average readiness was ${state.recovery.averageReadinessLast7Days}/100 across ${state.recovery.checkinsLast7Days} check-ins in the last 7 days.`,
      value: {
        kind: "recovery_low_7d",
        averageReadiness: state.recovery.averageReadinessLast7Days,
        checkinsLast7Days: state.recovery.checkinsLast7Days,
        windowDays: 7,
      },
      confidence: 0.8,
      importance: 0.8,
    });
  }

  if (
    state.body.measurementsLast30Days >= 2 &&
    state.body.weightChangeKgLast30Days !== null &&
    Math.abs(state.body.weightChangeKgLast30Days) >= 1
  ) {
    const change = state.body.weightChangeKgLast30Days;
    candidates.push({
      memoryKey: "derived:weight_change_30d",
      memoryType: "discovery",
      content: `Recorded weight changed by ${change > 0 ? "+" : ""}${change.toFixed(1)} kg across ${state.body.measurementsLast30Days} measurements in the last 30 days.`,
      value: {
        kind: "weight_change_30d",
        weightChangeKg: change,
        measurementsLast30Days: state.body.measurementsLast30Days,
        windowDays: 30,
      },
      confidence: 0.75,
      importance: 0.65,
    });
  }

  if (state.nutrition.loggedDaysLast14Days >= 10) {
    candidates.push({
      memoryKey: "derived:nutrition_logging_14d",
      memoryType: "nutrition_pattern",
      content: `Nutrition was logged on ${state.nutrition.loggedDaysLast14Days} of the last 14 days.`,
      value: {
        kind: "nutrition_logging_14d",
        loggedDaysLast14Days: state.nutrition.loggedDaysLast14Days,
        windowDays: 14,
      },
      confidence: 0.85,
      importance: 0.65,
    });
  }

  return z.array(CalculatedMemoryCandidateSchema).parse(candidates);
}

/**
 * Reconciles app-owned, deterministic memory through one server-only database
 * function. User-reported corrections are never overwritten by this process.
 */
export async function reconcileCalculatedUserMemory(
  userId: string,
  state: DigitalAthleteState,
  snapshot: AthleteStateSnapshotReference,
): Promise<{ candidateCount: number }> {
  const candidates = buildCalculatedMemoryCandidates(state);
  const entries = candidates.map((candidate) => ({
    memory_key: candidate.memoryKey,
    memory_type: candidate.memoryType,
    content: candidate.content,
    value: toJson(candidate.value),
    evidence_refs: toJson([
      {
        kind: "athlete_state_snapshot",
        snapshot_id: snapshot.id,
        schema_version: snapshot.schemaVersion,
      },
    ]),
    confidence: candidate.confidence,
    importance: candidate.importance,
  }));

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.rpc("reconcile_calculated_user_memory", {
    p_user_id: userId,
    p_entries: toJson(entries),
  });
  if (error) throw new Error("Could not reconcile calculated user memory.");

  return { candidateCount: candidates.length };
}
