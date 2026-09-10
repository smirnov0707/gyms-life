import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getPaddleClient } from "./paddle.server";
import { paymentEnvironment } from "./paddle-config.server";
import { PaddleEnvironmentSchema } from "./paddle-event.schema";
import { BillingPriceKeySchema } from "./paddle-catalog";
import { resolveApplicationPrice } from "./paddle-prices.server";
import { readPaymentSubscription, mirrorCancellation } from "./payment-subscription.service";

export const resolvePaddlePrice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ priceId: BillingPriceKeySchema, environment: PaddleEnvironmentSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const environment = paymentEnvironment();
    if (data.environment !== environment) throw new Error("PADDLE_ENVIRONMENT_MISMATCH");
    return resolveApplicationPrice(data.priceId, environment);
  });
export const getPortalUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const env = paymentEnvironment(),
      sub = await readPaymentSubscription(context.supabase, context.userId, env, "portal");
    const portal = await getPaddleClient(env).customerPortalSessions.create(
      sub.paddle_customer_id,
      [sub.paddle_subscription_id],
    );
    const url = z.string().url().parse(portal.urls.general.overview);
    if (new URL(url).protocol !== "https:") throw new Error("PADDLE_INVALID_PORTAL");
    return { url };
  });
export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const env = paymentEnvironment(),
      sub = await readPaymentSubscription(context.supabase, context.userId, env);
    if (sub.cancel_at_period_end) return { ok: true, synced: true };
    const result = await getPaddleClient(env).subscriptions.cancel(sub.paddle_subscription_id, {
      effectiveFrom: "next_billing_period",
    });
    if (result.id !== sub.paddle_subscription_id) throw new Error("PADDLE_UNCONFIRMED_CHANGE");
    const synced = await mirrorCancellation(context.supabase, context.userId, sub, true).catch(
      () => false,
    );
    return { ok: true, synced };
  });
export const resumeSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const env = paymentEnvironment(),
      sub = await readPaymentSubscription(context.supabase, context.userId, env);
    if (!sub.cancel_at_period_end) return { ok: true, synced: true };
    const result = await getPaddleClient(env).subscriptions.update(sub.paddle_subscription_id, {
      scheduledChange: null,
    });
    if (result.id !== sub.paddle_subscription_id) throw new Error("PADDLE_UNCONFIRMED_CHANGE");
    const synced = await mirrorCancellation(context.supabase, context.userId, sub, false).catch(
      () => false,
    );
    return { ok: true, synced };
  });
export const changePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ priceId: BillingPriceKeySchema }).parse(input))
  .handler(async ({ data, context }) => {
    const env = paymentEnvironment(),
      sub = await readPaymentSubscription(context.supabase, context.userId, env);
    if (sub.status === "past_due") throw new Error("PADDLE_PAYMENT_METHOD_REQUIRED");
    const priceId = await resolveApplicationPrice(data.priceId, env);
    const result = await getPaddleClient(env).subscriptions.update(sub.paddle_subscription_id, {
      items: [{ priceId, quantity: 1 }],
      prorationBillingMode: "full_next_billing_period",
    });
    if (result.id !== sub.paddle_subscription_id) throw new Error("PADDLE_UNCONFIRMED_CHANGE");
    return { ok: true };
  });
