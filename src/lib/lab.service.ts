import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { reconcileAthleteHypothesisLedger } from "./athlete-hypothesis-ledger.server";
import { loadHypothesisRetrospective } from "./athlete-hypothesis-retrospective.server";
import { buildAthleteHypotheses } from "./athlete-hypothesis.service";
import { buildDecisionAccuracy } from "./decision-accuracy.engine";
import { refreshAthleteStateSnapshot } from "./athlete-state-snapshot.server";
import { LabOverviewSchema, type LabDecision, type LabOverview } from "./lab.schema";
import { dayInTimeZone, dayOffset, IanaTimeZoneSchema } from "./local-day";
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
 * Reads the person's most recent Today decisions with their evidence and
 * outcome. A query failure degrades to an empty list rather than failing
 * the whole Lab overview: hypotheses remain visible even if history can't
 * be loaded right now.
 */
async function loadRecentDecisions(
  supabase: SupabaseClient<Database>,
  userId: string,
  since: string,
): Promise<LabDecision[]> {
  const { data: decisionRows, error: decisionError } = await supabase
    .from("decision_records")
    .select("id, decision_on, action, decision_basis, status, created_at")
    .eq("user_id", userId)
    .gte("decision_on", since)
    .order("decision_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(RECENT_DECISIONS_LIMIT);
  if (decisionError) return [];

  const parsedDecisions = z.array(RecentDecisionRowSchema).safeParse(decisionRows);
  if (!parsedDecisions.success || parsedDecisions.data.length === 0) return [];

  const decisionIds = parsedDecisions.data.map((row) => row.id);

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

  const parsedEvidence = z.array(DecisionEvidenceRowSchema).safeParse(evidenceResult.data ?? []);
  const parsedOutcomes = z.array(DecisionOutcomeRowSchema).safeParse(outcomeResult.data ?? []);

  return composeLabDecisions(
    parsedDecisions.data,
    parsedEvidence.success ? parsedEvidence.data : [],
    parsedOutcomes.success ? parsedOutcomes.data : [],
  );
}

/**
 * Loads the Lab overview from current canonical athlete state plus bounded,
 * auditable learning history. Hypothesis persistence remains secondary and
 * fail-open; Today never consumes the retrospective.
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

  // Reconcile first so a transition created from this canonical snapshot is
  // visible in the retrospective returned by the same Lab request.
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

  const [hypothesisHistory, decisions] = await Promise.all([
    loadHypothesisRetrospective(supabase, userId),
    loadRecentDecisions(supabase, userId, since),
  ]);

  return LabOverviewSchema.parse({
    hypotheses,
    hypothesisHistory,
    decisions,
    decisionAccuracy: buildDecisionAccuracy(decisions),
    dataGaps: athlete.state.dataGaps,
  });
}
