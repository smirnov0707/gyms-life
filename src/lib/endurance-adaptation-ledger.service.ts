import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import type {
  EnduranceAdaptationDecision,
  EnduranceAdaptationSignal,
} from "./endurance-adaptation.engine";
import { parseEnduranceAdaptationDecision } from "./endurance-adaptation.engine";

export const ENDURANCE_ADAPTATION_ENGINE_VERSION = "1.0";

export async function persistEnduranceAdaptation(
  _supabase: SupabaseClient<Database>,
  input: {
    userId: string;
    raceGoalId: string;
    decisionOn: string;
    signal: EnduranceAdaptationSignal;
    decision: EnduranceAdaptationDecision;
  },
) {
  const evidence = {
    plannedSessions: input.signal.plannedSessions,
    completedPlannedSessions: input.signal.completedPlannedSessions,
    lowResponseStreak: input.signal.lowResponseStreak,
    readinessBand: input.signal.readinessBand,
    distanceCompletionRatio: input.signal.distanceCompletionRatio ?? null,
    recentOverTargetRuns: input.signal.recentOverTargetRuns ?? 0,
  } satisfies Json;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("record_endurance_adaptation", {
    p_user_id: input.userId,
    p_race_goal_id: input.raceGoalId,
    p_decision_on: input.decisionOn,
    p_action: input.decision.action,
    p_volume_modifier: input.decision.volumeModifier,
    p_reason: input.decision.reason,
    p_evidence: evidence,
    p_engine_version: ENDURANCE_ADAPTATION_ENGINE_VERSION,
  });
  if (error) throw error;

  const record = data?.[0] ?? null;
  if (record) {
    const { recordPersonalTimelineEvent } = await import("./personal-timeline.server");
    await recordPersonalTimelineEvent(input.userId, {
      eventType: "endurance_adaptation",
      occurredAt: record.created_at,
      timeZone: null,
      provenance: "calculated",
      sourceSystem: "gymslife",
      sourceTable: "endurance_adaptation_records",
      sourceReference: record.id,
      summary: {
        decisionOn: input.decisionOn,
        action: record.action,
        volumeModifier: record.volume_modifier,
        reason: record.reason,
        engineVersion: ENDURANCE_ADAPTATION_ENGINE_VERSION,
      },
    });
  }

  return record;
}

export async function loadLatestEnduranceAdaptation(
  supabase: SupabaseClient<Database>,
  userId: string,
  raceGoalId: string,
  decisionOn: string,
): Promise<EnduranceAdaptationDecision | null> {
  const { data, error } = await supabase
    .from("endurance_adaptation_records")
    .select("action,volume_modifier,reason")
    .eq("user_id", userId)
    .eq("race_goal_id", raceGoalId)
    .eq("decision_on", decisionOn)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return parseEnduranceAdaptationDecision({
    action: data.action,
    volumeModifier: Number(data.volume_modifier),
    reason: data.reason,
  });
}
