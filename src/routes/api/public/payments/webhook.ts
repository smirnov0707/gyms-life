import { authorizeWebhookPrice } from "@/lib/paddle-config.server";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { verifyWebhook } from "@/lib/paddle.server";
import { handlePaddleWebhook, persistPaddleSubscription } from "@/lib/paddle-webhook.service";

let client: ReturnType<typeof createClient<Database>> | null = null;
function getSupabase() {
  if (!client) {
    const url = process.env["SUPABASE_URL"],
      key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!url || !key) throw new Error("PADDLE_PERSISTENCE_UNCONFIGURED");
    client = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handlePaddleWebhook(request, {
          verify: verifyWebhook,
          authorizePrice: (environment, event) =>
            authorizeWebhookPrice(environment, event.subscription.price_id, event.importedPriceKey),
          persist: (environment, event) =>
            persistPaddleSubscription(getSupabase(), environment, event),
          report: (code) => console.error(code),
        }),
    },
  },
});
