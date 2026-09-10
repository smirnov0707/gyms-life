import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { reviewPendingTodayEngagementPolicyOutcomes } from "./today-engagement-policy-review.server";

function fakeClient(rows: Array<{ id: string }>, rpcResults: boolean[]) {
  const limit = vi.fn().mockResolvedValue({ data: rows, error: null });
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    lte: vi.fn(),
    order: vi.fn(),
    limit,
  };
  for (const key of ["select", "eq", "is", "lte", "order"] as const) {
    query[key].mockReturnValue(query);
  }
  const rpc = vi.fn();
  rpcResults.forEach((value) => rpc.mockResolvedValueOnce({ data: value, error: null }));
  const client = {
    from: vi.fn().mockReturnValue(query),
    rpc,
  } as unknown as SupabaseClient<Database>;
  return { client, rpc, limit };
}

describe("policy shadow outcome reviewer", () => {
  it("counts only outcomes confirmed by the database evaluator", async () => {
    const rows = [1, 2, 3].map((n) => ({
      id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    }));
    const { client, rpc } = fakeClient(rows, [true, false, true]);
    const result = await reviewPendingTodayEngagementPolicyOutcomes(
      client,
      "11111111-1111-4111-8111-111111111111",
      new Date("2026-09-10T22:00:00Z"),
    );
    expect(result).toEqual({ checked: 3, evaluated: 2, limited: false });
    expect(rpc).toHaveBeenCalledTimes(3);
  });

  it("caps one review pass at 64 and reports remaining backlog", async () => {
    const rows = Array.from({ length: 65 }, (_, i) => ({
      id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    }));
    const { client, rpc, limit } = fakeClient(rows, Array(64).fill(true));
    const result = await reviewPendingTodayEngagementPolicyOutcomes(
      client,
      "11111111-1111-4111-8111-111111111111",
      new Date("2026-09-10T22:00:00Z"),
    );
    expect(result).toEqual({ checked: 64, evaluated: 64, limited: true });
    expect(limit).toHaveBeenCalledWith(65);
    expect(rpc).toHaveBeenCalledTimes(64);
  });
});
