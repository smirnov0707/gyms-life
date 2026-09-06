import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/integrations/supabase/types";
import {
  composeHypothesisRetrospective,
  HYPOTHESIS_RETROSPECTIVE_LIMIT,
  loadHypothesisRetrospective,
} from "./athlete-hypothesis-retrospective.server";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const SNAPSHOT_ID = "00000000-0000-4000-8000-000000000010";

function summary(status: "monitoring" | "supported" = "supported") {
  return {
    hypothesisId: "training-response-repeated-low-feeling",
    athleteStateSnapshotId: SNAPSHOT_ID,
    domain: "training_response",
    previousStatus: status === "supported" ? "monitoring" : null,
    status,
    statementKey: "athlete.hypothesis.trainingResponse.repeatedLowFeeling",
    evidence: [
      {
        key: "rated_sessions_28d",
        value: 6,
        unit: "sessions",
        source: "user_reported",
      },
    ],
    evidenceCount: 6,
    minimumEvidenceCount: 6,
    canInfluenceDecision: status === "supported",
    source: "deterministic",
  } as const;
}

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

describe("hypothesis retrospective", () => {
  it("maps valid newest-first transition rows and skips malformed legacy rows", () => {
    expect(
      composeHypothesisRetrospective([
        { occurred_at: "2026-09-06T16:00:00.000Z", summary: summary() },
        { occurred_at: "2026-09-05T16:00:00.000Z", summary: { status: "monitoring" } },
      ]),
    ).toEqual([
      {
        ...summary(),
        occurredAt: "2026-09-06T16:00:00.000Z",
      },
    ]);
  });

  it("uses an ownership-scoped, internal-event-only and bounded query", async () => {
    const { client, request } = clientFor([
      { occurred_at: "2026-09-06T16:00:00.000Z", summary: summary() },
    ]);

    const result = await loadHypothesisRetrospective(client, USER_ID);
    expect(result).toHaveLength(1);
    expect(request).toHaveBeenCalledOnce();

    const call = request.mock.calls[0];
    const url = new URL(String(call?.[0]));
    expect(url.pathname).toBe("/rest/v1/personal_timeline_events");
    expect(url.searchParams.get("user_id")).toBe(`eq.${USER_ID}`);
    expect(url.searchParams.get("event_type")).toBe("eq.hypothesis_transition");
    expect(url.searchParams.get("source_system")).toBe("eq.gymslife");
    expect(url.searchParams.get("source_table")).toBe("eq.athlete_hypothesis");
    expect(url.searchParams.get("order")).toBe("occurred_at.desc,id.desc");
    expect(url.searchParams.get("limit")).toBe(String(HYPOTHESIS_RETROSPECTIVE_LIMIT));
    expect(url.searchParams.get("select")).toBe("occurred_at,summary");
  });

  it("degrades a failed secondary read to empty history", async () => {
    const { client } = clientFor({ message: "private database detail", code: "42501" }, 403);
    await expect(loadHypothesisRetrospective(client, USER_ID)).resolves.toEqual([]);
  });

  it("does not query without an identity", async () => {
    const { client, request } = clientFor([]);
    await expect(loadHypothesisRetrospective(client, "")).resolves.toEqual([]);
    expect(request).not.toHaveBeenCalled();
  });
});
