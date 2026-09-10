import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  PolicyShadowOutcomeReviewSchema,
  type PolicyShadowOutcomeReview,
} from "./today-engagement-policy-canary.schema";

const REVIEW_LIMIT = 64;
const PendingPolicyRowSchema = z.object({ id: z.string().uuid() });

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

  return PolicyShadowOutcomeReviewSchema.parse({
    checked: pending.length,
    evaluated,
    limited,
  });
}
