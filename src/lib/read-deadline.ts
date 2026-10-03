/**
 * A read in a route loader cannot be allowed to hang.
 *
 * A loader blocks the route: the router resolves it and only then renders, so a
 * read that never answers is a page that never appears. The library page used
 * to open with its own loading state while the catalogue arrived; once the
 * catalogue moved into a loader, a stalled read took the whole page with it —
 * including, in the synthetic fixture, the watermark every check waits for,
 * which is how this was found.
 *
 * So these reads are fail-open twice over: a failure returns what it had, and
 * so does a silence. Both leave a reason behind, because fail-open is not
 * fail-silent.
 */

/** How long a pre-render read may take before the page goes on without it. */
export const READ_DEADLINE_MS = 2500;

export type DeadlineOutcome<T> = { status: "answered"; value: T } | { status: "timed_out" };

/**
 * Resolves with the read's value, or reports a timeout — never rejects.
 *
 * The timer is cleared on both paths, so a resolved read leaves nothing
 * pending; the losing promise is left to settle unobserved, which is harmless
 * here because the caller already has its answer.
 */
export async function withDeadline<T>(
  // `PromiseLike`, not `Promise`: a PostgREST builder is thenable and has no
  // `catch` or `finally`, so a `Promise` parameter rejects every call site this
  // exists for.
  read: PromiseLike<T>,
  deadlineMs: number = READ_DEADLINE_MS,
): Promise<DeadlineOutcome<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expiry = new Promise<DeadlineOutcome<T>>((resolve) => {
    timer = setTimeout(() => resolve({ status: "timed_out" }), deadlineMs);
  });
  try {
    return await Promise.race([
      Promise.resolve(read).then((value) => ({ status: "answered" as const, value })),
      expiry,
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
