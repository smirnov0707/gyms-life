import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { refreshEnduranceQueryCaches, subscribeTodayRefresh } from "./training-view-refresh";
const owner = "10000000-0000-4000-8000-000000000001";
const other = "20000000-0000-4000-8000-000000000002";

describe("saved endurance evidence refresh", () => {
  it("invalidates only the current owner's endurance and race queries", async () => {
    const client = new QueryClient();
    const own = [
      ["endurance-twin", owner],
      ["active-race-prep", owner, "2026-10-08"],
      ["active-race-prep", owner, "2026-10-09"],
    ];
    const untouched = [
      ["endurance-twin", other],
      ["active-race-prep", other],
      ["unrelated", owner],
    ];
    for (const key of [...own, ...untouched]) client.setQueryData(key, { synthetic: true });
    await refreshEnduranceQueryCaches(client, owner);
    for (const key of own) expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    for (const key of untouched) expect(client.getQueryState(key)?.isInvalidated).toBe(false);
    client.clear();
  });
  it("does not invalidate caches for an invalid owner", async () => {
    const client = new QueryClient();
    client.setQueryData(["endurance-twin", owner], {});
    await expect(refreshEnduranceQueryCaches(client, "")).rejects.toThrow();
    expect(client.getQueryState(["endurance-twin", owner])?.isInvalidated).toBe(false);
    client.clear();
  });
  it("refreshes Today after replay and coalesces a pair of new-run events", async () => {
    const target = new EventTarget();
    const refresh = vi.fn();
    const dispose = subscribeTodayRefresh(target, refresh);
    target.dispatchEvent(new Event("gymslife:training-completed"));
    target.dispatchEvent(new Event("gymslife:endurance-updated"));
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(1);
    target.dispatchEvent(new Event("gymslife:endurance-updated"));
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(2);
    dispose();
  });
  it("unsubscribes and discards queued reads when a view unmounts", async () => {
    const target = new EventTarget();
    const refresh = vi.fn();
    const dispose = subscribeTodayRefresh(target, refresh);
    target.dispatchEvent(new Event("gymslife:life-context"));
    dispose();
    target.dispatchEvent(new Event("gymslife:endurance-updated"));
    await Promise.resolve();
    expect(refresh).not.toHaveBeenCalled();
  });
});
