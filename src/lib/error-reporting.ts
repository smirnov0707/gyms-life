export function reportClientError(error: unknown, context: Record<string, unknown> = {}) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error("[GYMS.LIFE]", {
    message,
    stack,
    route: typeof window !== "undefined" ? window.location.pathname : undefined,
    ...context,
  });
}
