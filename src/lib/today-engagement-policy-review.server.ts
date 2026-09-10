import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  PolicyShadowOutcomeReviewSchema,
  type PolicyShadowOutcomeReview,
} from "./today-engagement-policy-canary.schema";
import { evaluateTodayEngagementProtocolReadiness } from "./today-engagement-policy-protocol.engine";
import type { TodayEngagementProtocolReadiness } from "./today-engagement-policy-protocol.schema";

const REVIEW_LIMIT = 64;
const HISTORY_LIMIT = 3650;
const PendingPolicyRowSchema = z.object({ id: z.string().uuid() });
const ReviewedPolicyRowSchema = z.object({
  decision_on: z.string(),
  candidate_strategy: z.string(),
  reviewed_at: z.string().datetime({ offset: true }),
});
export async function reviewPendingTodayEngagementPolicyOutcomes(
  client: SupabaseClient<Database>,
  userId: string,
  now = new Date(),
): Promise<PolicyShadowOutcomeReview> {
  z.string().uuid().parse(userId);
  const reviewedAt = now.toISOString();
  const { data, error } = await client
    .from("policy_shadow_records")
    .select("id")
    .eq("user_id", userId)
    .is("reviewed_at", null)
    .lte("horizon_ends_at", reviewedAt)
    .order("horizon_ends_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(REVIEW_LIMIT + 1);
  if (error || data === null) throw new Error("POLICY_SHADOW_PENDING_UNAVAILABLE");

  const rows = z
    .array(PendingPolicyRowSchema)
    .max(REVIEW_LIMIT + 1)
    .parse(data);
  const limited = rows.length > REVIEW_LIMIT;
  const pending = rows.slice(0, REVIEW_LIMIT);
  let evaluated = 0;
  for (const row of pending) {
    const { data: accepted, error: reviewError } = await client.rpc(
      "evaluate_today_engagement_policy_shadow",
      { p_user_id: userId, p_record_id: row.id, p_reviewed_at: reviewedAt },
    );
    if (reviewError) throw new Error("POLICY_SHADOW_REVIEW_FAILED");
    if (accepted === true) evaluated++;
  }
  return PolicyShadowOutcomeReviewSchema.parse({ checked: pending.length, evaluated, limited });
}

export async function loadTodayEngagementProtocolReadiness(
  client: SupabaseClient<Database>,
  userId: string,
  now = new Date(),
): Promise<TodayEngagementProtocolReadiness> {
  z.string().uuid().parse(userId);
  const reviewedAt = now.toISOString();
  const [{ data: rows, error }, { data: pending, error: pendingError }] = await Promise.all([
    client
      .from("policy_shadow_records")
      .select("decision_on,candidate_strategy,reviewed_at")
      .eq("user_id", userId)
      .not("reviewed_at", "is", null)
      .order("decision_on", { ascending: true })
      .limit(HISTORY_LIMIT + 1),
    client
      .from("policy_shadow_records")
      .select("id")
      .eq("user_id", userId)
      .is("reviewed_at", null)
      .lte("horizon_ends_at", reviewedAt)
      .limit(1),
  ]);
  if (error || rows === null || rows.length > HISTORY_LIMIT || pendingError || pending === null)
    throw new Error("POLICY_PROTOCOL_EVIDENCE_UNAVAILABLE");

  const reviewed = z.array(ReviewedPolicyRowSchema).parse(rows);
  const uniqueDays = new Set(reviewed.map((row) => row.decision_on));
  const counterfactualDays = new Set(
    reviewed
      .filter((row) => row.candidate_strategy === "choose_start_time_first")
      .map((row) => row.decision_on),
  );
  const { loadActivePersonalCompletionArtifact } =
    await import("./personal-completion-model.server");
  const artifact = await loadActivePersonalCompletionArtifact(client, userId);

  return evaluateTodayEngagementProtocolReadiness({
    personalModelQualified: artifact?.status === "qualified",
    reviewedShadowDays: uniqueDays.size,
    counterfactualDays: counterfactualDays.size,
    outcomeBacklogClear: pending.length === 0,
  });
}
