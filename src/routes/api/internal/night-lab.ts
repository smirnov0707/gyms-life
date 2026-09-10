import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/** Authenticated dispatch only; the background worker writes the authoritative result receipt. */

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export const Route = createFileRoute("/api/internal/night-lab")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rejection = await authenticateCronRequest(request);
        if (rejection) return rejection;

        const { dispatchCurrentNightLab } = await import("@/lib/night-lab.dispatch.server");
        const result = await dispatchCurrentNightLab();
        return json(result, result.status === "queued" ? 202 : 503);
      },
    },
  },
});
