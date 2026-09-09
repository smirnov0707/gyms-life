/** Bound elapsed time even when a provider adapter ignores cancellation. */
export async function withAiDeadline<T>(
  milliseconds: number,
  action: (signal: AbortSignal) => Promise<T>,
  parent?: AbortSignal,
): Promise<T> {
  if (!Number.isFinite(milliseconds) || milliseconds < 1 || milliseconds > 120_000)
    throw new Error("AI_INVALID_REQUEST");
  const controller = new AbortController();
  let rejectAbort: (reason: unknown) => void = () => {};
  const abortPromise = new Promise<never>((_resolve, reject) => {
    rejectAbort = reject;
  });
  const onAbort = () => rejectAbort(controller.signal.reason ?? new Error("AI_CANCELLED"));
  const onParent = () =>
    controller.abort(
      parent?.reason instanceof Error && parent.reason.message === "AI_TIMEOUT"
        ? parent.reason
        : new Error("AI_CANCELLED"),
    );
  controller.signal.addEventListener("abort", onAbort, { once: true });
  if (parent?.aborted) onParent();
  else parent?.addEventListener("abort", onParent, { once: true });
  const timer = setTimeout(() => controller.abort(new Error("AI_TIMEOUT")), milliseconds);
  try {
    return await Promise.race([
      abortPromise,
      Promise.resolve().then(() => {
        controller.signal.throwIfAborted();
        return action(controller.signal);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    controller.signal.removeEventListener("abort", onAbort);
    parent?.removeEventListener("abort", onParent);
  }
}
