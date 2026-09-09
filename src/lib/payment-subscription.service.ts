import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
const Subscription = z.object({
  id: z.string().uuid(),
  paddle_customer_id: z.string().regex(/^ctm_[a-z0-9]{26}$/),
  paddle_subscription_id: z.string().regex(/^sub_[a-z0-9]{26}$/),
  environment: z.enum(["sandbox", "live"]),
  status: z.string(),
  cancel_at_period_end: z.boolean().nullable(),
  updated_at: z.string().nullable(),
});
export async function readPaymentSubscription(
  client: SupabaseClient<Database>,
  userId: string,
  environment: "sandbox" | "live",
  mode: "manage" | "portal" = "manage",
) {
  let query = client
    .from("subscriptions")
    .select(
      "id,paddle_customer_id,paddle_subscription_id,environment,status,cancel_at_period_end,updated_at",
    )
    .eq("user_id", userId)
    .eq("environment", environment);
  if (mode === "manage") query = query.in("status", ["active", "trialing", "past_due"]);
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("SUBSCRIPTION_READ_FAILED");
  if (!data) throw new Error("SUBSCRIPTION_NOT_FOUND");
  const sub = Subscription.parse(data);
  if (sub.environment !== environment) throw new Error("PADDLE_ENVIRONMENT_MISMATCH");
  return sub;
}
/** A zero-row mirror write is not a synchronization success. */
export async function mirrorCancellation(
  client: SupabaseClient<Database>,
  userId: string,
  sub: z.infer<typeof Subscription>,
  cancel: boolean,
): Promise<boolean> {
  let query = client
    .from("subscriptions")
    .update({ cancel_at_period_end: cancel })
    .eq("id", sub.id)
    .eq("user_id", userId)
    .eq("environment", sub.environment);
  query =
    sub.updated_at === null ? query.is("updated_at", null) : query.eq("updated_at", sub.updated_at);
  const { data, error } = await query.select("id").maybeSingle();
  return !error && data?.id === sub.id;
}
