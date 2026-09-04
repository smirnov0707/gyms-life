import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { verifyWebhook, EventName, type PaddleEnv } from "@/lib/paddle.server";

const PaddleEnvironmentSchema = z.enum(["sandbox", "live"]);
const UserIdSchema = z.string().uuid();

type PaddleWebhookEvent = Awaited<ReturnType<typeof verifyWebhook>>;
type SubscriptionCreatedData = Extract<
  PaddleWebhookEvent,
  { eventType: EventName.SubscriptionCreated }
>["data"];
type SubscriptionUpdatedData = Extract<
  PaddleWebhookEvent,
  { eventType: EventName.SubscriptionUpdated }
>["data"];
type SubscriptionCanceledData = Extract<
  PaddleWebhookEvent,
  { eventType: EventName.SubscriptionCanceled }
>["data"];

let _supabase: ReturnType<typeof createClient<Database>> | null = null;

function requiredEnv(key: "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY"): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not configured`);
  return value;
}

function getSupabase() {
  if (!_supabase) {
    _supabase = createClient<Database>(
      requiredEnv("SUPABASE_URL"),
      requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );
  }
  return _supabase;
}

async function handleSubscriptionCreated(data: SubscriptionCreatedData, env: PaddleEnv) {
  const { id, customerId, items, status, currentBillingPeriod, customData } = data;

  const userId = UserIdSchema.safeParse(customData?.["userId"]);
  if (!userId.success) {
    console.error("Subscription webhook is missing a valid user ID");
    return;
  }

  const item = items[0];
  const priceId = item?.price?.importMeta?.externalId;
  const productId = item?.product?.importMeta?.externalId;
  if (!priceId || !productId) {
    console.warn("Skipping subscription: missing importMeta.externalId", {
      rawPriceId: item?.price?.id,
      rawProductId: item?.product?.id,
    });
    return;
  }

  await getSupabase()
    .from("subscriptions")
    .upsert(
      {
        user_id: userId.data,
        paddle_subscription_id: id,
        paddle_customer_id: customerId,
        product_id: productId,
        price_id: priceId,
        status,
        current_period_start: currentBillingPeriod?.startsAt ?? null,
        current_period_end: currentBillingPeriod?.endsAt ?? null,
        environment: env,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "paddle_subscription_id" },
    );
}

async function handleSubscriptionUpdated(data: SubscriptionUpdatedData, env: PaddleEnv) {
  const { id, status, currentBillingPeriod, scheduledChange } = data;

  await getSupabase()
    .from("subscriptions")
    .update({
      status,
      current_period_start: currentBillingPeriod?.startsAt ?? null,
      current_period_end: currentBillingPeriod?.endsAt ?? null,
      cancel_at_period_end: scheduledChange?.action === "cancel",
      updated_at: new Date().toISOString(),
    })
    .eq("paddle_subscription_id", id)
    .eq("environment", env);
}

async function handleSubscriptionCanceled(data: SubscriptionCanceledData, env: PaddleEnv) {
  await getSupabase()
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("paddle_subscription_id", data.id)
    .eq("environment", env);
}

/**
 * Real idempotency, not just an audit log: Paddle retries webhook delivery,
 * and event_id is this table's primary key, so a second insert for the same
 * event fails with a unique violation. That failure IS the duplicate check.
 */
async function isDuplicateWebhookEvent(
  eventId: string,
  eventType: string,
  env: PaddleEnv,
): Promise<boolean> {
  const { error } = await getSupabase()
    .from("paddle_webhook_events")
    .insert({ event_id: eventId, event_type: eventType, environment: env });
  if (!error) return false;
  if (error.code === "23505") return true;
  throw new Error(`Could not record Paddle webhook event: ${error.message}`);
}

async function handleWebhook(req: Request, env: PaddleEnv) {
  const event = await verifyWebhook(req, env);

  if (await isDuplicateWebhookEvent(event.eventId, event.eventType, env)) {
    console.log("Skipping already-processed Paddle webhook event:", event.eventId);
    return;
  }

  switch (event.eventType) {
    case EventName.SubscriptionCreated:
      await handleSubscriptionCreated(event.data, env);
      break;
    case EventName.SubscriptionUpdated:
      await handleSubscriptionUpdated(event.data, env);
      break;
    case EventName.SubscriptionCanceled:
      await handleSubscriptionCanceled(event.data, env);
      break;
    default:
      console.log("Unhandled event:", event.eventType);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const parsedEnvironment = PaddleEnvironmentSchema.safeParse(
          url.searchParams.get("env") ?? "sandbox",
        );
        if (!parsedEnvironment.success) {
          return new Response("Invalid payment environment", { status: 400 });
        }
        const env = parsedEnvironment.data;
        try {
          await handleWebhook(request, env);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
