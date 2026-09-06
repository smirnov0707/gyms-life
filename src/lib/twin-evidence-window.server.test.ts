import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/integrations/supabase/types";
import { PERSONAL_TIMELINE_LIMIT } from "./personal-timeline.read";
import { loadTwinEvidenceWindow } from "./twin-evidence-window.server";

function clientFor(body: unknown, status = 200) {
  const request = vi.fn<typeof fetch>().mockImplementation(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  );
  const client = createClient<Database>("https://example.supabase.co", "test-publishable-key", {
    global: { fetch: request },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return { client, request };
}

const USER_ID = "00000000-0000-4000-8000-000000000001";
const input = {
  olderAt: "2026-09-06T12:00:00+03:00",
  newerAt: "2026-09-06T13:00:00+03:00",
};

describe("authenticated Twin evidence reader", () => {
  it("uses ownership, bounded projection, both occurrence-time boundaries, and excludes derived hypothesis audit rows", async () => {
    const { client, request } = clientFor([]);
    expect((await loadTwinEvidenceWindow(client, USER_ID, input)).events).toEqual([]);
    expect(request).toHaveBeenCalledOnce();
    const url = new URL(String(request.mock.calls[0]?.[0]));
    expect(url.pathname).toBe("/rest/v1/personal_timeline_events");
    expect(url.searchParams.get("user_id")).toBe(`eq.${USER_ID}`);
    expect(url.searchParams.get("event_type")).toBe("neq.hypothesis_transition");
    expect(url.searchParams.getAll("occurred_at")).toEqual([
      "gt.2026-09-06T09:00:00.000Z",
      "lte.2026-09-06T10:00:00.000Z",
    ]);
    expect(url.searchParams.get("order")).toBe("occurred_at.desc,id.desc");
    expect(url.searchParams.get("limit")).toBe(String(PERSONAL_TIMELINE_LIMIT + 1));
    expect(url.searchParams.get("select")).not.toContain("summary");
    expect(url.searchParams.get("select")).not.toContain("user_id");
  });

  it("rejects a missing authenticated identity without making a request", async () => {
    const { client, request } = clientFor([]);
    await expect(loadTwinEvidenceWindow(client, "", input)).rejects.toThrow(
      "Authentication is required",
    );
    expect(request).not.toHaveBeenCalled();
  });

  it("does not turn a failed source read into an empty evidence interval", async () => {
    const { client } = clientFor({ message: "private database detail", code: "42501" }, 403);
    await expect(loadTwinEvidenceWindow(client, USER_ID, input)).rejects.toThrow(
      "Twin evidence is temporarily unavailable.",
    );
  });

  it("rejects malformed successful responses", async () => {
    await expect(loadTwinEvidenceWindow(clientFor(null).client, USER_ID, input)).rejects.toThrow();
    await expect(
      loadTwinEvidenceWindow(clientFor({ unexpected: true }).client, USER_ID, input),
    ).rejects.toThrow();
  });
});
