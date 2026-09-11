import { createFileRoute } from "@tanstack/react-router";
import { handleThreeDLookPersonalizedTwinWebhook } from "@/lib/personalized-twin.provider-webhook-handler.server";

export const Route = createFileRoute("/api/public/personalized-twin/webhook")({
  server: {
    handlers: {
      POST: ({ request }) => handleThreeDLookPersonalizedTwinWebhook(request),
    },
  },
});
