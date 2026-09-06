import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/integrations/supabase/types";
import { loadPersonalTimeline } from "./personal-timeline.read.server";
import { PERSONAL_TIMELINE_LIMIT } from "./personal-timeline.read";

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

describe("authenticated personal timeline reader", () => {
  it("uses an ownership filter, deterministic order, and a bounded metadata-only select", async () => {
    const { client, request } = clientFor([]);
    expect((await loadPersonalTimeline(client, USER_ID)).events).toEqual([]);
    expect(request).toHaveBeenCalledOnce();
    const call = request.mock.calls[0];
    const url = new URL(String(call?.[0]));
    expect(url.pathname).toBe("/rest/v1/personal_timeline_events");
    expect(url.searchParams.get("user_id")).toBe(`eq.${USER_ID}`);
    expect(url.searchParams.get("order")).toBe("occurred_at.desc,id.desc");
    expect(url.searchParams.get("limit")).toBe(String(PERSONAL_TIMELINE_LIMIT + 1));
    expect(url.searchParams.get("select")).not.toContain("summary");
    expect(url.searchParams.get("select")).not.toContain("*");
  });

  it("rejects an absent identity without making a request", async () => {
    const { client, request } = clientFor([]);
    await expect(loadPersonalTimeline(client, "")).rejects.toThrow("Authentication is required");
    expect(request).not.toHaveBeenCalled();
  });

  it("does not hide a failed read behind an empty timeline or leak database details", async () => {
    const { client } = clientFor({ message: "private database detail", code: "42501" }, 403);
    await expect(loadPersonalTimeline(client, USER_ID)).rejects.toThrow(
      "Personal timeline is temporarily unavailable.",
    );
  });

  it("rejects null and malformed successful responses", async () => {
    await expect(loadPersonalTimeline(clientFor(null).client, USER_ID)).rejects.toThrow();
    await expect(
      loadPersonalTimeline(clientFor({ unexpected: true }).client, USER_ID),
    ).rejects.toThrow();
  });
});
