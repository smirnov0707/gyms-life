/**
 * Why a dispatch did not happen.
 *
 * The Night Lab was scheduled on 2026-09-08 and `background_job_runs` held zero
 * rows on 2026-09-29. Three weeks of nightly firings and not one record
 * anywhere — because the ledger only starts recording once a run has been
 * claimed, and every gate in front of that claim answered with a bare
 * `unavailable`. A job that cannot say why it refused is a job nobody can find
 * out about, which is exactly how `personal_timeline_events` ran broken for
 * weeks; the difference is that the timeline writer at least recorded 233
 * failures, and that is the only reason it was ever found.
 *
 * These codes are written into the ledger as `error_code`, so they match its
 * format: `^[A-Z][A-Z0-9_]{2,63}$`.
 */
export const DISPATCH_REFUSALS = [
  "DISPATCH_SECRET_MISSING",
  "DISPATCH_SECRET_MALFORMED",
  "DISPATCH_ORIGIN_MISSING",
  "DISPATCH_ORIGIN_UNSAFE",
  "DISPATCH_WORKER_REFUSED",
  "DISPATCH_TRANSPORT_FAILED",
] as const;

export type DispatchRefusal = (typeof DISPATCH_REFUSALS)[number];

export type DispatchResult =
  { status: "queued" } | { status: "unavailable"; reason: DispatchRefusal; workerStatus?: number };

/** A validated explicit target, not a build/environment URL. Queued is not completed. */
export async function dispatchNightLab(
  input: { origin?: string; secret?: string | undefined },
  transport: typeof fetch = fetch,
): Promise<DispatchResult> {
  const { origin, secret } = input;
  if (!secret) return { status: "unavailable", reason: "DISPATCH_SECRET_MISSING" };
  if (/[\s,]/.test(secret)) return { status: "unavailable", reason: "DISPATCH_SECRET_MALFORMED" };
  if (!origin) return { status: "unavailable", reason: "DISPATCH_ORIGIN_MISSING" };
  try {
    const base = new URL(origin);
    if (
      base.protocol !== "https:" ||
      base.username ||
      base.password ||
      base.port ||
      base.pathname !== "/" ||
      base.search ||
      base.hash
    )
      return { status: "unavailable", reason: "DISPATCH_ORIGIN_UNSAFE" };
    const url = new URL("/.netlify/functions/night-lab-worker-background", base);
    const response = await transport(url, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    await response.body?.cancel();
    if (response.status === 202) return { status: "queued" };
    // The worker's own status is the most useful single number here: 401 says
    // the two halves disagree about the secret, 404 says the background
    // function is not deployed, 5xx says it is and it broke.
    return {
      status: "unavailable",
      reason: "DISPATCH_WORKER_REFUSED",
      workerStatus: response.status,
    };
  } catch {
    // A malformed origin, a refused connection, or the ten-second timeout. The
    // cause is deliberately not carried: it can name environment variables.
    return { status: "unavailable", reason: "DISPATCH_TRANSPORT_FAILED" };
  }
}
