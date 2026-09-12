import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/integrations/supabase/types";
import {
  composeTwinMemoryProactiveRecords,
  loadTwinMemoryProactiveRecords,
} from "./twin-memory-proactive.server";

function clientFor(body: unknown, status = 200) {
  const request = vi.fn<typeof fetch>().mockImplementation(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  );
  const client = createClient<Database>("https://example.supabase.co", "test-key", {
    global: { fetch: request },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return { client, request };
}

const USER_ID = "00000000-0000-4000-8000-000000000001";
const SNAPSHOT_ID = "11111111-1111-4111-8111-111111111111";
const FINGERPRINT = `twin-memory:fatigue:strengthened:${SNAPSHOT_ID}`;
const signal = {
  fingerprint: FINGERPRINT,
  hypothesisId: "fatigue",
  kind: "strengthened" as const,
  severity: "positive" as const,
  source: "deterministic" as const,
  decisionAuthority: false as const,
  athleteStateSnapshotId: SNAPSHOT_ID,
};

function changeRow(at = "2026-09-12T08:00:00.000Z") {
  return {
    event_type: "twin_memory_change",
    occurred_at: at,
    source_reference: FINGERPRINT,
    summary: signal,
  };
}

function lifecycleRow(action: "seen" | "dismissed", at: string) {
  return {
    event_type: action === "seen" ? "twin_memory_seen" : "twin_memory_dismissed",
    occurred_at: at,
    source_reference: FINGERPRINT,
    summary: {
      fingerprint: FINGERPRINT,
      action,
      source: "deterministic",
      decisionAuthority: false,
    },
  };
}

describe("Twin Memory proactive audit reader", () => {
  it("derives new, seen and dismissed lifecycle states from append-only audit rows", () => {
    expect(composeTwinMemoryProactiveRecords([changeRow()])).toEqual([
      expect.objectContaining({ status: "new", statusChangedAt: null }),
    ]);
    expect(
      composeTwinMemoryProactiveRecords([
        lifecycleRow("seen", "2026-09-12T09:00:00.000Z"),
        changeRow(),
      ]),
    ).toEqual([
      expect.objectContaining({ status: "seen", statusChangedAt: "2026-09-12T09:00:00.000Z" }),
    ]);
    expect(
      composeTwinMemoryProactiveRecords([
        lifecycleRow("dismissed", "2026-09-12T10:00:00.000Z"),
        lifecycleRow("seen", "2026-09-12T09:00:00.000Z"),
        changeRow(),
      ]),
    ).toEqual([
      expect.objectContaining({
        status: "dismissed",
        statusChangedAt: "2026-09-12T10:00:00.000Z",
      }),
    ]);
  });

  it("ignores malformed lifecycle rows and lifecycle timestamps older than the change", () => {
    const malformed = {
      ...lifecycleRow("seen", "2026-09-12T09:00:00.000Z"),
      summary: {
        fingerprint: "other",
        action: "seen",
        source: "deterministic",
        decisionAuthority: false,
      },
    };
    expect(composeTwinMemoryProactiveRecords([malformed, changeRow()])).toEqual([
      expect.objectContaining({ status: "new" }),
    ]);
    expect(
      composeTwinMemoryProactiveRecords([
        changeRow("2026-09-12T10:00:00.000Z"),
        lifecycleRow("seen", "2026-09-12T09:00:00.000Z"),
      ]),
    ).toEqual([expect.objectContaining({ status: "new" })]);
  });

  it("reads only the authenticated athlete's Twin Memory audit events", async () => {
    const { client, request } = clientFor([changeRow()]);
    const result = await loadTwinMemoryProactiveRecords(client, USER_ID);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: "strengthened", status: "new" });
    const url = new URL(String(request.mock.calls[0]?.[0]));
    expect(url.searchParams.get("user_id")).toBe(`eq.${USER_ID}`);
    expect(url.searchParams.get("event_type")).toContain("twin_memory_change");
    expect(url.searchParams.get("source_system")).toBe("eq.gymslife");
    expect(url.searchParams.get("source_table")).toBe("eq.twin_memory");
  });

  it("fails closed on unreadable or malformed audit data", async () => {
    await expect(
      loadTwinMemoryProactiveRecords(clientFor({ message: "denied" }, 403).client, USER_ID),
    ).resolves.toEqual([]);
    await expect(
      loadTwinMemoryProactiveRecords(
        clientFor([{ event_type: "bad", occurred_at: "bad", source_reference: "x", summary: {} }])
          .client,
        USER_ID,
      ),
    ).resolves.toEqual([]);
  });
});
