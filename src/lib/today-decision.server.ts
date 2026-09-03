import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { refreshAthleteStateSnapshot } from "./athlete-state-snapshot.server";
import { getActivePlanData } from "./active-plan.service";
import { buildTodayDecision, fingerprintTodayDecision } from "./today-decision.engine";
import {
  StoredTodayDecisionEvidenceSchema,
  StoredTodayDecisionSchema,
  TodayDecisionOutcomeSchema,
  TodayDecisionSchema,
  type TodayDecision,
  type TodayDecisionOutcome,
} from "./today-decision.schema";

function utcDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function utcDayBounds(day: string): { start: string; end: string } {
  const start = new Date(`${day}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function statusForOutcome(outcome: TodayDecisionOutcome): "accepted" | "dismissed" | "completed" {
  if (outcome === "accepted") return "accepted";
  if (outcome === "completed") return "completed";
  return "dismissed";
}

/**
 * Builds one daily action from RLS-scoped facts, then persists the exact
 * decision and its typed evidence via the service role. No AI provider reads
 * or writes this decision path.
 */
export async function getOrCreateTodayDecision(
  supabase: SupabaseClient<Database>,
  userId: string,
  now = new Date(),
): Promise<TodayDecision> {
  const decisionOn = utcDay(now);
  const { start, end } = utcDayBounds(decisionOn);

  const [athlete, activePlan, readinessResult, completedWorkoutResult] = await Promise.all([
    refreshAthleteStateSnapshot(supabase, userId),
    getActivePlanData(supabase, userId),
    supabase
      .from("daily_checkins")
      .select("id, readiness_score")
      .eq("user_id", userId)
      .eq("checkin_on", decisionOn)
      .maybeSingle(),
    supabase
      .from("workout_sessions")
      .select("id")
      .eq("user_id", userId)
      .not("finished_at", "is", null)
      .gte("started_at", start)
      .lt("started_at", end)
      .limit(1)
      .maybeSingle(),
  ]);

  if (readinessResult.error) throw new Error("Today readiness lookup failed.");
  if (completedWorkoutResult.error) throw new Error("Today workout lookup failed.");
  if (!athlete.snapshot) {
    throw new Error("Today decision is unavailable until all athlete data sources respond.");
  }

  const proposal = buildTodayDecision({
    decisionOn,
    hasActiveTrainingPlan: activePlan.status === "READY",
    hasCompletedReadinessToday:
      readinessResult.data !== null && readinessResult.data.readiness_score !== null,
    hasCompletedWorkoutToday: completedWorkoutResult.data !== null,
    state: athlete.state,
  });
  const decisionFingerprint = fingerprintTodayDecision(proposal, athlete.snapshot.id);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error: insertError } = await supabaseAdmin.from("decision_records").upsert(
    {
      user_id: userId,
      athlete_state_snapshot_id: athlete.snapshot.id,
      decision_on: proposal.decisionOn,
      engine_version: proposal.engineVersion,
      decision_fingerprint: decisionFingerprint,
      action: proposal.action,
      alternatives: proposal.alternatives,
      confidence: proposal.confidence,
      safety_constraints: proposal.safetyConstraints,
    },
    {
      onConflict: "user_id,decision_on,decision_fingerprint,engine_version",
      ignoreDuplicates: true,
    },
  );
  if (insertError) throw new Error("Could not store today's decision.");

  const { data: record, error: recordError } = await supabaseAdmin
    .from("decision_records")
    .select(
      "id, athlete_state_snapshot_id, decision_on, engine_version, decision_fingerprint, action, alternatives, confidence, safety_constraints, status, created_at",
    )
    .eq("user_id", userId)
    .eq("decision_on", proposal.decisionOn)
    .eq("engine_version", proposal.engineVersion)
    .eq("decision_fingerprint", decisionFingerprint)
    .maybeSingle();
  if (recordError || !record) throw new Error("Could not read today's decision.");

  const parsedRecord = StoredTodayDecisionSchema.safeParse(record);
  if (!parsedRecord.success) throw new Error("Stored today decision is invalid.");

  const { error: evidenceError } = await supabaseAdmin.from("decision_evidence").upsert(
    proposal.evidence.map((item) => ({
      decision_id: parsedRecord.data.id,
      evidence_key: item.key,
      evidence_value: item.value,
      source_class: item.sourceClass,
      position: item.position,
    })),
    { onConflict: "decision_id,position" },
  );
  if (evidenceError) throw new Error("Could not store today decision evidence.");

  const { data: storedEvidence, error: storedEvidenceError } = await supabaseAdmin
    .from("decision_evidence")
    .select("evidence_key, evidence_value, source_class, position")
    .eq("decision_id", parsedRecord.data.id)
    .order("position", { ascending: true });
  if (storedEvidenceError) throw new Error("Could not read today decision evidence.");

  const parsedEvidence = z.array(StoredTodayDecisionEvidenceSchema).safeParse(storedEvidence);
  if (!parsedEvidence.success) throw new Error("Stored today decision evidence is invalid.");

  return TodayDecisionSchema.parse({
    id: parsedRecord.data.id,
    snapshotId: parsedRecord.data.athlete_state_snapshot_id,
    engineVersion: parsedRecord.data.engine_version,
    decisionOn: parsedRecord.data.decision_on,
    action: parsedRecord.data.action,
    alternatives: parsedRecord.data.alternatives,
    confidence: parsedRecord.data.confidence,
    safetyConstraints: parsedRecord.data.safety_constraints,
    status: parsedRecord.data.status,
    evidence: parsedEvidence.data.map((item) => ({
      key: item.evidence_key,
      value: item.evidence_value,
      sourceClass: item.source_class,
      position: item.position,
    })),
    createdAt: parsedRecord.data.created_at,
  });
}

/** Records an explicit response after an RLS-scoped ownership check. */
export async function recordTodayDecisionOutcome(
  supabase: SupabaseClient<Database>,
  userId: string,
  decisionId: string,
  outcome: TodayDecisionOutcome,
): Promise<void> {
  const validatedOutcome = TodayDecisionOutcomeSchema.parse(outcome);
  const { data: ownedRecord, error: ownershipError } = await supabase
    .from("decision_records")
    .select("id")
    .eq("id", decisionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (ownershipError || !ownedRecord) throw new Error("Today decision was not found.");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error: outcomeError } = await supabaseAdmin
    .from("decision_outcomes")
    .upsert({ decision_id: decisionId, outcome: validatedOutcome }, { onConflict: "decision_id" });
  if (outcomeError) throw new Error("Could not store today decision outcome.");

  const { error: statusError } = await supabaseAdmin
    .from("decision_records")
    .update({ status: statusForOutcome(validatedOutcome) })
    .eq("id", decisionId)
    .eq("user_id", userId);
  if (statusError) throw new Error("Could not update today decision status.");
}

/**
 * A completed workout is stronger evidence than an accepted CTA. This helper
 * is intentionally non-blocking for workout completion: an audit write issue
 * must never prevent a user from saving a finished session.
 */
export async function completeCurrentTrainingDecision(
  userId: string,
  completedAt: Date,
): Promise<boolean> {
  return completeCurrentDecision(userId, completedAt, ["train_adapted", "train_as_planned"]);
}

/** Marks a completed readiness check-in as the result of today's readiness action. */
export async function completeCurrentReadinessDecision(
  userId: string,
  completedAt: Date,
): Promise<boolean> {
  return completeCurrentDecision(userId, completedAt, ["complete_readiness"]);
}

async function completeCurrentDecision(
  userId: string,
  completedAt: Date,
  actions: Array<"complete_readiness" | "train_adapted" | "train_as_planned">,
): Promise<boolean> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: decision, error: decisionError } = await supabaseAdmin
      .from("decision_records")
      .select("id")
      .eq("user_id", userId)
      .eq("decision_on", utcDay(completedAt))
      .in("action", actions)
      .in("status", ["active", "accepted"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (decisionError || !decision) return false;

    const { error: outcomeError } = await supabaseAdmin
      .from("decision_outcomes")
      .upsert({ decision_id: decision.id, outcome: "completed" }, { onConflict: "decision_id" });
    if (outcomeError) return false;

    const { error: statusError } = await supabaseAdmin
      .from("decision_records")
      .update({ status: "completed" })
      .eq("id", decision.id)
      .eq("user_id", userId);
    return statusError === null;
  } catch {
    return false;
  }
}
