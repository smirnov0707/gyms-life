import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { assessAdaptationOutcome } from "./endurance-adaptation-outcome.engine";

const DAY_MS = 86_400_000;
const LOW_FEELING_THRESHOLD = 2;

function lowFeelingStreakAfter(
  rows: readonly { started_at: string; feeling: number | null }[],
): number {
  const rated = [...rows]
    .filter((row) => row.feeling !== null)
    .sort((left, right) => right.started_at.localeCompare(left.started_at));

  let streak = 0;
  for (const row of rated) {
    if ((row.feeling ?? Number.POSITIVE_INFINITY) > LOW_FEELING_THRESHOLD) break;
    streak += 1;
  }
  return streak;
}

function readinessBand(
  score: number | null | undefined,
): "low" | "moderate" | "high" | "unknown" {
  if (score === null || score === undefined) return "unknown";
  if (score < 55) return "low";
  if (score < 80) return "moderate";
  return "high";
}

export async function recordDueAdaptationOutcomes(
  supabase: SupabaseClient<Database>,
  userId: string,
  now = new Date(),
) {
  const nowIso = now.toISOString();
  const cutoff = new Date(now.getTime() - 3 * DAY_MS).toISOString();

  const { data: records, error } = await supabase
    .from("endurance_adaptation_records")
    .select("id,created_at")
    .eq("user_id", userId)
    .is("outcome", null)
    .lte("created_at", cutoff)
    .order("created_at")
    .limit(10);
  if (error) throw error;

  for (const record of records ?? []) {
    const { data: runs, error: runsError } = await supabase
      .from("workout_sessions")
      .select("started_at,feeling")
      .eq("user_id", userId)
      .eq("activity_kind", "run")
      .not("finished_at", "is", null)
      .gte("started_at", record.created_at)
      .lte("started_at", nowIso)
      .order("started_at", { ascending: false });
    if (runsError) throw runsError;

    const { data: checkin, error: checkinError } = await supabase
      .from("daily_checkins")
      .select("readiness_score,created_at")
      .eq("user_id", userId)
      .gt("created_at", record.created_at)
      .lte("created_at", nowIso)
      .not("readiness_score", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (checkinError) throw checkinError;

    const outcome = assessAdaptationOutcome({
      sessionsAfter: runs?.length ?? 0,
      lowResponseStreakAfter: lowFeelingStreakAfter(runs ?? []),
      readinessBandAfter: readinessBand(checkin?.readiness_score),
      daysObserved: Math.floor((now.getTime() - Date.parse(record.created_at)) / DAY_MS),
    });
    if (outcome.status === "too_early") continue;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: recorded, error: updateError } = await supabaseAdmin.rpc(
      "record_endurance_adaptation_outcome",
      {
        p_user_id: userId,
        p_record_id: record.id,
        p_outcome: outcome as unknown as Json,
        p_recorded_at: nowIso,
      },
    );
    if (updateError) throw updateError;
    if (!recorded) continue;

    const { recordPersonalTimelineEvent } = await import("./personal-timeline.server");
    await recordPersonalTimelineEvent(userId, {
      eventType: "endurance_adaptation_observed",
      occurredAt: nowIso,
      timeZone: null,
      provenance: "calculated",
      sourceSystem: "gymslife",
      sourceTable: "endurance_adaptation_records",
      sourceReference: record.id,
      summary: {
        association: outcome.association,
        causalClaim: false,
        facts: outcome.facts,
      },
    });
  }
}
