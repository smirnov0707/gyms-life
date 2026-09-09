import { nightLabHttpStatus } from "@/lib/night-lab.http";
import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * The door the scheduler knocks on.
 *
 * Netlify's scheduled functions live in their own bundle and cannot import
 * this application's modules, so the schedule is a thin caller and the work
 * stays here, where the domain code, the types and the service-role client
 * already are. That costs one extra function invocation a night and avoids a
 * second copy of the Night Lab compiled by a different bundler.
 *
 * The guard is `authenticateCronRequest`, which already existed for exactly
 * this and had no caller. It is the canonical one rather than a second one:
 * it compares fixed-length digests instead of raw secrets, so the comparison
 * cannot leak a length and cannot throw on a mismatch, and it accepts
 * `GYMSLIFE_CRON_SECRET_PREVIOUS` as well, so the secret can be rotated
 * without a night where the schedule is locked out.
 *
 * With no secret configured it refuses everything. An unauthenticated endpoint
 * that runs work for every athlete is worse than a Night Lab that does not
 * run, so a misconfigured deploy fails closed.
 */

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

        const { runNightLab } = await import("@/lib/night-lab.server");

        try {
          const report = await runNightLab();
          // The response is the ledger's account of the run, so a failing
          // schedule is visible to whoever is looking at the scheduler as well
          // as to whoever is looking at the database.
          return json(report, nightLabHttpStatus(report));
        } catch {
          // A misconfigured deploy fails before the ledger can be written at
          // all — the service-role client is built on first use — and the
          // framework's HTML error page would tell the scheduler nothing it
          // could log. A stable code does. The message is deliberately not
          // included: it can name environment variables.
          return json({ error: "night_lab_failed" }, 500);
        }
      },
    },
  },
});
