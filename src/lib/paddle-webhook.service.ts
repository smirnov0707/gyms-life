import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { serializeJson } from "./json.schema";
import { normalizePaddleSubscriptionEvent, PaddleEnvironmentSchema } from "./paddle-event.schema";

const Outcome = z.enum(["applied", "duplicate", "stale"]);
type Event = NonNullable<ReturnType<typeof normalizePaddleSubscriptionEvent>>;
export async function persistPaddleSubscription(
  client: SupabaseClient<Database>,
  environment: "sandbox" | "live",
  event: Event,
) {
  const { data, error } = await client.rpc("apply_verified_paddle_subscription", {
    p_event_id: event.eventId,
    p_event_type: event.eventType,
    p_environment: environment,
    p_occurred_at: event.occurredAt,
    p_subscription: serializeJson(event.subscription),
  });
  if (error) throw new Error("PADDLE_PERSISTENCE_FAILED");
  return Outcome.parse(data);
}
export async function handlePaddleWebhook(
  request: Request,
  dependencies: {
    verify: (request: Request, environment: "sandbox" | "live") => Promise<unknown>;
    authorizePrice: (environment: "sandbox" | "live", event: Event) => void;
    persist: (environment: "sandbox" | "live", event: Event) => Promise<z.infer<typeof Outcome>>;
    report: (code: string) => void;
  },
): Promise<Response> {
  const env = PaddleEnvironmentSchema.safeParse(
    new URL(request.url).searchParams.get("env") ?? "sandbox",
  );
  if (!env.success) return new Response("Invalid payment environment", { status: 400 });
  let verified: unknown;
  try {
    verified = await dependencies.verify(request, env.data);
  } catch {
    dependencies.report("PADDLE_WEBHOOK_VERIFICATION_FAILED");
    return new Response("Webhook verification failed", { status: 400 });
  }
  let event: Event | null;
  try {
    event = normalizePaddleSubscriptionEvent(verified);
  } catch {
    dependencies.report("PADDLE_WEBHOOK_CONTRACT_REJECTED");
    return new Response("Webhook payload rejected", { status: 422 });
  }
  if (!event) return Response.json({ received: true, ignored: true });
  try {
    dependencies.authorizePrice(env.data, event);
  } catch {
    dependencies.report("PADDLE_APPLICATION_PRICE_REJECTED");
    return new Response("Unsupported application price", { status: 422 });
  }
  try {
    const outcome = Outcome.parse(await dependencies.persist(env.data, event));
    return Response.json({ received: true, outcome });
  } catch {
    // Receipt and state roll back together. No separate best-effort claim release.
    dependencies.report("PADDLE_WEBHOOK_PERSISTENCE_FAILED");
    return new Response("Webhook temporarily unavailable", { status: 503 });
  }
}
