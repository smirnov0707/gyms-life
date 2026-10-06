import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import type {
  EnduranceAdaptationDecision,
  EnduranceAdaptationSignal,
} from "./endurance-adaptation.engine";

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

  const { createHash } = await import("node:crypto");
  const decisionFingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        decisionOn: input.decisionOn,
        evidence,
        decision: input.decision,
        engineVersion: ENDURANCE_ADAPTATION_ENGINE_VERSION,
      }),
    )
    .digest("hex");

  const canonical=[input.decision.action,String(input.decision.volumeModifier),input.decision.reason,String(evidence.plannedSessions),String(evidence.completedPlannedSessions),String(evidence.lowResponseStreak),String(evidence.readinessBand),String(evidence.distanceCompletionRatio),String(evidence.recentOverTargetRuns)].join("|");
 const decisionFingerprint=await sha256Hex(canonical);
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
    p_decision_fingerprint: decisionFingerprint,
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
        decisionFingerprint,
      },
    });
  }

  return record;
}
