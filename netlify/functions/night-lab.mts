import type { Config } from "@netlify/functions";

/**
 * The only scheduled thing in this system.
 *
 * It carries no logic on purpose. Netlify bundles functions separately from the
 * application, without its path aliases or its typed Supabase client, so a
 * Night Lab implemented here would be a second copy of the domain compiled by a
 * different toolchain — the duplicate architecture the constitution warns
 * against. This knocks on the application's own door instead and lets the work
 * happen where the domain already lives.
 *
 * The run is idempotent at the database, so a schedule that fires twice, a
 * retry after a timeout, or a manual call all produce one run for the period.
 * That is what makes it safe for this function to be as dumb as it is.
 *
 * 03:10 UTC, not 03:00: a schedule on the hour shares the platform's busiest
 * minute for no reason, and nothing here is time-critical to ten minutes.
 */

export default async function nightLab(): Promise<Response> {
  // The same secret the application's cron guard already expects. Rotation is
  // handled at the other end, which accepts the previous value too, so this
  // side only ever needs the current one.
  const secret = process.env["GYMSLIFE_CRON_SECRET"];
  const base = process.env["URL"];

  if (!secret || !base) {
    // Fail loudly in the scheduler rather than silently in the ledger: a
    // deploy missing either of these should look broken, not idle.
    console.error("[NightLab] missing GYMSLIFE_CRON_SECRET or URL");
    return new Response("not configured", { status: 500 });
  }

  const response = await fetch(new URL("/api/internal/night-lab", base), {
    method: "POST",
    headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
  });

  const body = await response.text();
  // The application's answer is the ledger's own account of the run, so this
  // line is the whole observability story for the schedule itself.
  console.log("[NightLab]", response.status, body.slice(0, 500));
  return new Response(body, { status: response.status });
}

export const config: Config = { schedule: "10 3 * * *" };
