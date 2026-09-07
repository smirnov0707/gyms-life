import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { reconcileAthleteHypothesisLedger } from "./athlete-hypothesis-ledger.server";
import { loadHypothesisRetrospective } from "./athlete-hypothesis-retrospective.server";
import { buildAthleteHypotheses } from "./athlete-hypothesis.service";
import { buildDecisionAccuracy } from "./decision-accuracy.engine";
import { refreshAthleteStateSnapshot } from "./athlete-state-snapshot.server";
import {
  LabOverviewSchema,
  type LabDecision,
  type LabOverview,
  type LabUnreadableSource,
} from "./lab.schema";
import { dayInTimeZone, dayOffset, IanaTimeZoneSchema } from "./local-day";
import { loadPredictionCalibration } from "./prediction-calibration.server";
import { reconcileWorkoutCompletionShadowPredictions } from "./prediction-shadow-ledger.server";
import {
  TodayDecisionActionSchema,
  TodayDecisionBasisSchema,
  TodayDecisionEvidenceKeySchema,
  TodayDecisionEvidenceSourceSchema,
  TodayDecisionOutcomeSchema,
  TodayDecisionStatusSchema,
} from "./today-decision.schema";

const RECENT_DECISIONS_LOOKBACK_DAYS = 14;
const RECENT_DECISIONS_LIMIT = 20;

export const RecentDecisionRowSchema = z
  .object({
    id: z.string().uuid(),
    decision_on: z.string().min(1),
    action: TodayDecisionActionSchema,
    decision_basis: TodayDecisionBasisSchema,
    status: TodayDecisionStatusSchema,
    created_at: z.string().min(1),
  })
  .strict();

export const DecisionEvidenceRowSchema = z
  .object({
    decision_id: z.string().uuid(),
    evidence_key: TodayDecisionEvidenceKeySchema,
    evidence_value: z.string().trim().min(1).max(100),
    source_class: TodayDecisionEvidenceSourceSchema,
    position: z.number().int().min(0).max(10),
  })
  .strict();

export const DecisionOutcomeRowSchema = z
  .object({
    decision_id: z.string().uuid(),
    outcome: TodayDecisionOutcomeSchema,
  })
  .strict();

export type RecentDecisionRow = z.infer<typeof RecentDecisionRowSchema>;
export type DecisionEvidenceRow = z.infer<typeof DecisionEvidenceRowSchema>;
export type DecisionOutcomeRow = z.infer<typeof DecisionOutcomeRowSchema>;

/**
 * Joins already-validated decision/evidence/outcome rows into the Lab
 * journal shape. Pure and deterministic so it is testable without a
 * Supabase client: given the same three row sets, always the same result.
 */
export function composeLabDecisions(
  decisionRows: RecentDecisionRow[],
  evidenceRows: DecisionEvidenceRow[],
  outcomeRows: DecisionOutcomeRow[],
): LabDecision[] {
  const evidenceByDecision = new Map<string, LabDecision["evidence"]>();
  for (const row of evidenceRows) {
    const existing = evidenceByDecision.get(row.decision_id) ?? [];
    existing.push({
      key: row.evidence_key,
      value: row.evidence_value,
      sourceClass: row.source_class,
      position: row.position,
    });
    evidenceByDecision.set(row.decision_id, existing);
  }

  const outcomeByDecision = new Map<string, LabDecision["outcome"]>();
  for (const row of outcomeRows) outcomeByDecision.set(row.decision_id, row.outcome);

  return decisionRows.map((row) => ({
    id: row.id,
    decisionOn: row.decision_on,
    action: row.action,
    basis: row.decision_basis,
    status: row.status,
    evidence: evidenceByDecision.get(row.id) ?? [],
    outcome: outcomeByDecision.get(row.id) ?? null,
    createdAt: row.created_at,
  }));
}

/**
 * Keeps the rows that parse and reports whether any were lost.
 *
 * All-or-nothing validation on a list is the wrong trade here: one row a
 * schema cannot read used to cost every decision its evidence, and a decision
 * shown with no evidence in a screen built entirely around evidence reads as
 * a decision made on none. One bad row now costs one line, and the loss is
 * stated rather than absorbed.
 */
export function parseRows<T>(schema: z.ZodType<T>, rows: unknown): { rows: T[]; lost: boolean } {
  if (!Array.isArray(rows)) return { rows: [], lost: rows != null };
  const kept: T[] = [];
  let lost = false;
  for (const row of rows) {
    const parsed = schema.safeParse(row);
    if (parsed.success) kept.push(parsed.data);
    else lost = true;
  }
  return { rows: kept, lost };
}

/**
 * Reads the person's most recent Today decisions with their evidence and
 * outcome. A source that could not be read is named rather than rendered as
 * an empty history: hypotheses stay visible either way, but "you made no
 * decisions" and "we could not read your decisions" are different sentences
 * and the Lab has to say which one it means.
 */
async function loadRecentDecisions(
  supabase: SupabaseClient<Database>,
  userId: string,
  since: string,
): Promise<{ decisions: LabDecision[]; unreadable: LabUnreadableSource[] }> {
  const { data: decisionRows, error: decisionError } = await supabase
    .from("decision_records")
    .select("id, decision_on, action, decision_basis, status, created_at")
    .eq("user_id", userId)
    .gte("decision_on", since)
    .order("decision_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(RECENT_DECISIONS_LIMIT);
  if (decisionError) return { decisions: [], unreadable: ["decisions"] };

  const parsedDecisions = parseRows(RecentDecisionRowSchema, decisionRows ?? []);
  const unreadable: LabUnreadableSource[] = parsedDecisions.lost ? ["decisions"] : [];
  if (parsedDecisions.rows.length === 0) return { decisions: [], unreadable };

  const decisionIds = parsedDecisions.rows.map((row) => row.id);

  const [evidenceResult, outcomeResult] = await Promise.all([
    supabase
      .from("decision_evidence")
      .select("decision_id, evidence_key, evidence_value, source_class, position")
      .in("decision_id", decisionIds)
      .order("position", { ascending: true }),
    supabase
      .from("decision_outcomes")
      .select("decision_id, outcome")
      .in("decision_id", decisionIds),
  ]);

  const parsedEvidence = parseRows(DecisionEvidenceRowSchema, evidenceResult.data ?? []);
  const parsedOutcomes = parseRows(DecisionOutcomeRowSchema, outcomeResult.data ?? []);
  if (evidenceResult.error || parsedEvidence.lost) unreadable.push("decision_evidence");
  if (outcomeResult.error || parsedOutcomes.lost) unreadable.push("decision_outcomes");

  return {
    decisions: composeLabDecisions(parsedDecisions.rows, parsedEvidence.rows, parsedOutcomes.rows),
    unreadable,
  };
}

/**
 * Loads the Lab overview from current canonical athlete state plus bounded,
 * auditable learning history. Hypothesis and prediction audit plumbing remains
 * secondary and fail-open; neither retrospective can become a Today input.
 */
export async function loadLabOverview(
  supabase: SupabaseClient<Database>,
  userId: string,
  timeZone = "UTC",
  now = new Date(),
): Promise<LabOverview> {
  const zone = IanaTimeZoneSchema.parse(timeZone);
  const today = dayInTimeZone(now, zone);
  const since = dayOffset(today, -RECENT_DECISIONS_LOOKBACK_DAYS);

  const athlete = await refreshAthleteStateSnapshot(supabase, userId, zone, now);
  const hypotheses = buildAthleteHypotheses(athlete.state);

  // Reconcile first so transitions and prediction outcomes created from facts
  // already present in this request are visible in the same Lab response.
  if (athlete.snapshot) {
    await reconcileAthleteHypothesisLedger(
      supabase,
      userId,
      hypotheses,
      athlete.snapshot.id,
      zone,
      now,
    );
  }
  await reconcileWorkoutCompletionShadowPredictions(userId, now).catch(() => undefined);

  const [hypothesisHistory, recent, predictionCalibration] = await Promise.all([
    loadHypothesisRetrospective(supabase, userId),
    loadRecentDecisions(supabase, userId, since),
    loadPredictionCalibration(supabase, userId),
  ]);

  return LabOverviewSchema.parse({
    hypotheses,
    hypothesisHistory,
    decisions: recent.decisions,
    decisionAccuracy: buildDecisionAccuracy(recent.decisions),
    predictionCalibration,
    dataGaps: athlete.state.dataGaps,
    unreadable: recent.unreadable,
  });
}
