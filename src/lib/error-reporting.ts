/**
 * Browser consoles are visible to the member, so production diagnostics must
 * not include transport errors or stack traces. Local development retains the
 * original exception for fast debugging.
 */
export function reportClientError(error: unknown, context: Record<string, unknown> = {}) {
  if (import.meta.env.DEV) {
    console.error("[GYMS.LIFE] client error", error, context);
    return;
  }

  console.error("[GYMS.LIFE] client error", {
    route: typeof window !== "undefined" ? window.location.pathname : undefined,
    ...context,
  });
}
