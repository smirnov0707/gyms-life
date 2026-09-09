import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTwinSceneAttempt, TWIN_SCENE_LOAD_TIMEOUT_MS } from "./twin-scene.attempt";
import type { TwinBodyProvenance } from "./twin-body.provenance";

const provenance: TwinBodyProvenance = {
  source: "makehuman",
  credit: "Synthetic test credit",
  candidate: true,
  sha256: "0".repeat(64),
};
const setup = () => {
  const callbacks = { onReady: vi.fn(), onFailure: vi.fn(), onRelease: vi.fn() };
  const handle = { dispose: vi.fn() };
  return { attempt: createTwinSceneAttempt(callbacks), handle, ...callbacks };
};
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("Twin scene load attempt", () => {
  it("keeps the deadline after renderer attachment until a body is ready", () => {
    const { attempt, handle, onFailure, onRelease } = setup();
    expect(attempt.attach(handle)).toBe(true);
    vi.advanceTimersByTime(TWIN_SCENE_LOAD_TIMEOUT_MS - 1);
    expect(onFailure).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onRelease).toHaveBeenCalledWith(handle);
    expect(handle.dispose).toHaveBeenCalledTimes(1);
    expect(attempt.active()).toBe(false);
  });
  it("times out an import that never returns and refuses its late scene", () => {
    const { attempt, handle, onFailure, onReady, onRelease } = setup();
    vi.advanceTimersByTime(TWIN_SCENE_LOAD_TIMEOUT_MS);
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(attempt.attach(handle)).toBe(false);
    attempt.ready(provenance);
    expect(handle.dispose).toHaveBeenCalledTimes(1);
    expect(onReady).not.toHaveBeenCalled();
    expect(onRelease).not.toHaveBeenCalled();
  });
  it("shares one deadline across the import and body request", () => {
    const { attempt, handle, onFailure } = setup();
    vi.advanceTimersByTime(10_000);
    attempt.attach(handle);
    vi.advanceTimersByTime(5_000);
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(handle.dispose).toHaveBeenCalledTimes(1);
  });
  it("clears the deadline only after body readiness", () => {
    const { attempt, handle, onReady, onFailure } = setup();
    attempt.attach(handle);
    attempt.ready(provenance);
    expect(onReady).toHaveBeenCalledWith(provenance);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(60_000);
    expect(onFailure).not.toHaveBeenCalled();
    expect(handle.dispose).not.toHaveBeenCalled();
  });
  it("preserves an explicit fallback and later verified provenance", () => {
    const { attempt, handle, onReady } = setup();
    attempt.attach(handle);
    attempt.ready(null);
    attempt.ready(provenance);
    expect(onReady.mock.calls).toEqual([[null], [provenance]]);
    expect(handle.dispose).not.toHaveBeenCalled();
  });
  it("still handles WebGL context loss after a successful load", () => {
    const { attempt, handle, onReady, onFailure } = setup();
    attempt.attach(handle);
    attempt.ready(provenance);
    attempt.fail();
    attempt.fail();
    attempt.ready(provenance);
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(handle.dispose).toHaveBeenCalledTimes(1);
  });
  it("disposes a scene returned after a synchronous mount failure", () => {
    const { attempt, handle, onFailure } = setup();
    attempt.fail();
    expect(attempt.attach(handle)).toBe(false);
    expect(handle.dispose).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("accepts readiness delivered synchronously during mounting", () => {
    const { attempt, handle, onReady, onFailure } = setup();
    attempt.ready(provenance);
    expect(attempt.attach(handle)).toBe(true);
    vi.advanceTimersByTime(60_000);
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onFailure).not.toHaveBeenCalled();
    attempt.dispose();
    expect(handle.dispose).toHaveBeenCalledTimes(1);
  });
  it("unmount cancels the deadline and silences late callbacks", () => {
    const { attempt, handle, onReady, onFailure, onRelease } = setup();
    attempt.attach(handle);
    attempt.dispose();
    attempt.dispose();
    attempt.ready(provenance);
    attempt.fail();
    vi.advanceTimersByTime(60_000);
    expect(handle.dispose).toHaveBeenCalledTimes(1);
    expect(onRelease).toHaveBeenCalledTimes(1);
    expect(onReady).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("gives retry its own deadline and ignores the previous attempt", () => {
    const old = setup();
    old.attempt.attach(old.handle);
    vi.advanceTimersByTime(TWIN_SCENE_LOAD_TIMEOUT_MS);
    const next = setup();
    next.attempt.attach(next.handle);
    old.attempt.ready(provenance);
    old.attempt.fail();
    old.attempt.dispose();
    vi.advanceTimersByTime(TWIN_SCENE_LOAD_TIMEOUT_MS - 1);
    expect(next.onFailure).not.toHaveBeenCalled();
    next.attempt.ready(provenance);
    vi.advanceTimersByTime(60_000);
    expect(next.onReady).toHaveBeenCalledTimes(1);
    expect(next.handle.dispose).not.toHaveBeenCalled();
    expect(old.onReady).not.toHaveBeenCalled();
  });
  it("cancels the model request through disposal without reentering failure", () => {
    const { attempt, onFailure } = setup();
    const controller = new AbortController();
    controller.signal.addEventListener("abort", attempt.fail);
    const dispose = vi.fn(() => controller.abort());
    attempt.attach({ dispose });
    vi.advanceTimersByTime(TWIN_SCENE_LOAD_TIMEOUT_MS);
    expect(controller.signal.aborted).toBe(true);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledTimes(1);
  });
});
