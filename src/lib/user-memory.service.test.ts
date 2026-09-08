import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/integrations/supabase/types";
import { USER_MEMORY_TRANSPARENCY_LIMIT, loadUserMemoryTransparency } from "./user-memory.service";

/**
 * The memory page's own heading is "what GYMS.LIFE currently knows". A bound
 * it does not mention makes it quietly answer a different question — "the
 * first fifty of what we know" — and the athlete has no way to tell which one
 * they are reading.
 */

const USER_ID = "00000000-0000-4000-8000-000000000001";

const memoryRow = (index: number) => ({
  id: `018f2e48-0000-4000-8000-${String(index).padStart(12, "0")}`,
  memory_type: "training_pattern",
  content: `Fact ${index}`,
  source: "user_reported",
  confidence: 0.9,
  importance: 0.8,
  status: "active",
  value: null,
  evidence_refs: [],
  last_confirmed_at: "2026-09-01T00:00:00.000Z",
  expires_at: null,
});

function clientFor(rows: unknown[]) {
  const request = vi.fn<typeof fetch>().mockImplementation(
    async () =>
      new Response(JSON.stringify(rows), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  );
  const client = createClient<Database>("https://example.supabase.co", "test-publishable-key", {
    global: { fetch: request },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return { client, request };
}

describe("the athlete's active memory page", () => {
  it("asks for one row beyond the limit, so it can tell full from overflowing", () => {
    const { client, request } = clientFor([]);
    return loadUserMemoryTransparency(client, USER_ID).then(() => {
      const url = new URL(String(request.mock.calls[0]?.[0]));
      expect(url.searchParams.get("limit")).toBe(String(USER_MEMORY_TRANSPARENCY_LIMIT + 1));
    });
  });

  it("says nothing is missing when the athlete has exactly the limit", () => {
    const rows = Array.from({ length: USER_MEMORY_TRANSPARENCY_LIMIT }, (_, i) => memoryRow(i));
    const { client } = clientFor(rows);
    return loadUserMemoryTransparency(client, USER_ID).then((page) => {
      expect(page.items).toHaveLength(USER_MEMORY_TRANSPARENCY_LIMIT);
      expect(page.hasMore).toBe(false);
    });
  });

  it("says so when there is more, and never shows the extra row it fetched", () => {
    const rows = Array.from({ length: USER_MEMORY_TRANSPARENCY_LIMIT + 1 }, (_, i) => memoryRow(i));
    const { client } = clientFor(rows);
    return loadUserMemoryTransparency(client, USER_ID).then((page) => {
      expect(page.hasMore).toBe(true);
      // The probe row is how the page knows; it is not part of the answer.
      expect(page.items).toHaveLength(USER_MEMORY_TRANSPARENCY_LIMIT);
      expect(page.limit).toBe(USER_MEMORY_TRANSPARENCY_LIMIT);
    });
  });

  it("refuses rather than reporting an empty memory it could not read", () => {
    // An athlete with facts must never be told they have none because a query
    // failed. This is the defect this codebase has a whole lint test for.
    const request = vi.fn<typeof fetch>().mockImplementation(
      async () =>
        new Response(JSON.stringify({ message: "boom" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
    );
    const client = createClient<Database>("https://example.supabase.co", "test-publishable-key", {
      global: { fetch: request },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    return expect(loadUserMemoryTransparency(client, USER_ID)).rejects.toThrow(
      "Could not load user memory",
    );
  });
});
