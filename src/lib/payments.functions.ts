import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gatewayFetch, getPaddleClient, type PaddleEnv } from "@/lib/paddle.server";

export const resolvePaddlePrice = createServerFn({ method: "GET" })
  .validator((data: { priceId: string; environment: PaddleEnv }) => data)
  .handler(async ({ data }) => {
    const response = await gatewayFetch(
      data.environment,
      `/prices?external_id=${encodeURIComponent(data.priceId)}`,
    );
    const result = await response.json();
    if (!result.data?.length) throw new Error("Price not found");
    return result.data[0].id as string;
  });

// Opens Paddle's hosted customer portal (cancel / update payment method / invoices).
export const getPortalUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: sub, error: subError } = await supabase
      .from("subscriptions")
      .select("paddle_customer_id, paddle_subscription_id, environment")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (subError) throw new Error("Could not read your subscription. Please try again.");
    if (!sub) throw new Error("No subscription found");
    const paddle = getPaddleClient(sub.environment as PaddleEnv);
    const portal = await paddle.customerPortalSessions.create(sub.paddle_customer_id, [
      sub.paddle_subscription_id,
    ]);
    return { url: portal.urls.general.overview };
  });

// Cancels at the end of the paid period — access stays until current_period_end.
export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: sub, error: subError } = await supabase
      .from("subscriptions")
      .select("id, paddle_subscription_id, environment, status")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (subError) throw new Error("Could not read your subscription. Please try again.");
    if (!sub || !["active", "trialing", "past_due"].includes(sub.status)) {
      throw new Error("No active subscription");
    }
    const paddle = getPaddleClient(sub.environment as PaddleEnv);
    await paddle.subscriptions.cancel(sub.paddle_subscription_id, {
      effectiveFrom: "next_billing_period",
    } as never);
    // Paddle has already accepted the cancellation, so this is the local
    // mirror catching up, not the cancellation itself — throwing here would
    // tell the athlete their subscription is still running when it is not.
    // But a discarded failure is worse: the page would keep showing a
    // subscription with no cancellation scheduled, right up until access
    // ended. `synced` lets the caller say which of the two it is looking at.
    const { error: mirrorError } = await supabase
      .from("subscriptions")
      .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
      .eq("id", sub.id);
    if (mirrorError) {
      console.error("Cancellation accepted by Paddle but not mirrored", {
        code: mirrorError.code,
      });
    }
    return { ok: true, synced: mirrorError === null };
  });

// Undoes a scheduled cancellation.
export const resumeSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: sub, error: subError } = await supabase
      .from("subscriptions")
      .select("id, paddle_subscription_id, environment")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (subError) throw new Error("Could not read your subscription. Please try again.");
    if (!sub) throw new Error("No subscription found");
    const paddle = getPaddleClient(sub.environment as PaddleEnv);
    await paddle.subscriptions.update(sub.paddle_subscription_id, {
      scheduledChange: null,
    } as never);
    // Same shape as the cancellation above: Paddle is the source of truth and
    // has already resumed; a dropped mirror write left the page showing a
    // cancellation that was never going to happen.
    const { error: mirrorError } = await supabase
      .from("subscriptions")
      .update({ cancel_at_period_end: false, updated_at: new Date().toISOString() })
      .eq("id", sub.id);
    if (mirrorError) {
      console.error("Resume accepted by Paddle but not mirrored", { code: mirrorError.code });
    }
    return { ok: true, synced: mirrorError === null };
  });

// Switches the user's plan. The new plan takes over at the next renewal:
// no pro-rated charge now, the full new price is billed on the next billing date.
export const changePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { priceId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: sub, error: subError } = await supabase
      .from("subscriptions")
      .select("paddle_subscription_id, environment, status")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (subError) throw new Error("Could not read your subscription. Please try again.");
    if (!sub || !["active", "trialing", "past_due"].includes(sub.status)) {
      throw new Error("No active subscription");
    }
    const env = sub.environment as PaddleEnv;
    const res = await gatewayFetch(env, `/prices?external_id=${encodeURIComponent(data.priceId)}`);
    const json = await res.json();
    const paddlePriceId = json.data?.[0]?.id as string | undefined;
    if (!paddlePriceId) throw new Error("Price not found");

    const paddle = getPaddleClient(env);
    await paddle.subscriptions.update(sub.paddle_subscription_id, {
      items: [{ priceId: paddlePriceId, quantity: 1 }],
      prorationBillingMode: "full_next_billing_period",
    } as never);
    return { ok: true };
  });
