import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/integrations/supabase/types";
import { loadTwinRewindHistory } from "./twin-rewind.server";
import { TWIN_REWIND_LIMIT } from "./twin-rewind";

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

describe("authenticated Twin Rewind reader", () => {
  it("uses ownership, deterministic ordering and a bounded snapshot query", async () => {
    const { client, request } = clientFor([]);
    expect((await loadTwinRewindHistory(client, USER_ID)).points).toEqual([]);
    expect(request).toHaveBeenCalledOnce();
    const url = new URL(String(request.mock.calls[0]?.[0]));
    expect(url.pathname).toBe("/rest/v1/athlete_state_snapshots");
    expect(url.searchParams.get("user_id")).toBe(`eq.${USER_ID}`);
    expect(url.searchParams.get("order")).toBe("computed_at.desc,id.desc");
    expect(url.searchParams.get("limit")).toBe(String(TWIN_REWIND_LIMIT + 1));
    expect(url.searchParams.get("select")).not.toContain("user_id");
    expect(url.searchParams.get("select")).not.toContain("provenance_summary");
    expect(url.searchParams.get("select")).not.toContain("uncertainty_summary");
  });

  it("rejects a missing authenticated identity without making a request", async () => {
    const { client, request } = clientFor([]);
    await expect(loadTwinRewindHistory(client, "")).rejects.toThrow("Authentication is required");
    expect(request).not.toHaveBeenCalled();
  });

  it("does not turn a failed source read into no history", async () => {
    const { client } = clientFor({ message: "private database detail", code: "42501" }, 403);
    await expect(loadTwinRewindHistory(client, USER_ID)).rejects.toThrow(
      "Twin history is temporarily unavailable.",
    );
  });

  it("rejects malformed successful responses", async () => {
    await expect(loadTwinRewindHistory(clientFor(null).client, USER_ID)).rejects.toThrow();
    await expect(
      loadTwinRewindHistory(clientFor({ unexpected: true }).client, USER_ID),
    ).rejects.toThrow();
  });
});
