import { describe, expect, it, vi } from "vitest";
import { READ_DEADLINE_MS, withDeadline } from "./read-deadline";

/**
 * A route loader blocks the route. The library page used to open with its own
 * loading state while the catalogue arrived; once the catalogue moved into a
 * loader, a read that never answered took the whole page with it — including
 * the synthetic watermark every browser check waits for, which is how it was
 * found rather than shipped.
 *
 * This helper bounds the wait and nothing else: it does not swallow failures.
 * The callers already had a `try` that reports a code and returns what they
 * had, and that is where the decision about what to show belongs.
 */

describe("a pre-render read that is allowed to take its time but not forever", () => {
  it("answers with the value when the read answers", async () => {
    await expect(withDeadline(Promise.resolve(7))).resolves.toEqual({
      status: "answered",
      value: 7,
    });
  });

  it("accepts a thenable, because a PostgREST builder is one", async () => {
    // Not a `Promise`: no `catch`, no `finally`. A `Promise` parameter rejects
    // every call site this exists for, and the compiler said so.
    const builder: PromiseLike<{ data: number[] }> = {
      then: (resolve) => Promise.resolve({ data: [1] }).then(resolve),
    };
    await expect(withDeadline(builder)).resolves.toEqual({
      status: "answered",
      value: { data: [1] },
    });
  });

  it("reports a timeout instead of waiting on a read that never answers", async () => {
    vi.useFakeTimers();
    try {
      const outcome = withDeadline<never>(new Promise(() => {}), 50);
      await vi.advanceTimersByTimeAsync(50);
      await expect(outcome).resolves.toEqual({ status: "timed_out" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not time out a read that answers inside the deadline", async () => {
    vi.useFakeTimers();
    try {
      const outcome = withDeadline(
        new Promise((resolve) => setTimeout(() => resolve("in time"), 10)),
        50,
      );
      await vi.advanceTimersByTimeAsync(10);
      await expect(outcome).resolves.toEqual({ status: "answered", value: "in time" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("passes a rejection through, which is why every caller wraps it", async () => {
    // Named for what it does. A rejected read is not swallowed here: the race
    // rejects, and `readExerciseRow` and `readExerciseCatalogueIndex` catch it
    // in the `try` they already had and report the _THREW code. Swallowing it
    // in this helper would move that decision away from the callers that know
    // what to return instead.
    await expect(withDeadline(Promise.reject(new Error("boom")))).rejects.toThrow("boom");
  });

  it("has a deadline a person would wait through, not one they would not", () => {
    expect(READ_DEADLINE_MS).toBeGreaterThanOrEqual(1000);
    expect(READ_DEADLINE_MS).toBeLessThanOrEqual(5000);
  });
});
