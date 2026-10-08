import { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/integrations/supabase/types";
import { recordEnduranceActivity } from "./endurance-activity.service";
const deps = vi.hoisted(() => ({ sync: vi.fn() }));
vi.mock("./endurance-race-sync.service", () => ({ synchronizeEnduranceRace: deps.sync }));
const USER = "10000000-0000-4000-8000-000000000001";
const RUN = "20000000-0000-4000-8000-000000000002";
const activity = {
  kind: "run",
  environment: "treadmill",
  source: "manual",
  startedAt: "2026-09-07T08:00:00Z",
  durationSeconds: 1800,
  distanceMeters: 5000,
  perceivedEffort: 4,
};
function boundary(failed = false) {
  const fetch = vi.fn(
    async () =>
      new Response(
        JSON.stringify(
          failed
            ? { code: "42501", message: "synthetic refused insert" }
            : { id: RUN, started_at: activity.startedAt, finished_at: "2026-09-07T08:30:00Z" },
        ),
        { status: failed ? 403 : 201, headers: { "content-type": "application/json" } },
      ),
  );
  const client = new SupabaseClient<Database>("https://synthetic.invalid", "synthetic-test-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch },
  });
  return { client, fetch };
}
beforeEach(() => {
  vi.resetAllMocks();
  deps.sync.mockResolvedValue({
    raceMatch: null,
    raceIntelligence: null,
    raceSync: { status: "deferred", phase: "matching" },
  });
});
describe("durable endurance recording boundary", () => {
  it("returns a saved run and training credit even when plan enrichment is deferred", async () => {
    const b = boundary();
    const result = await recordEnduranceActivity(b.client, USER, activity);
    expect(result.session.id).toBe(RUN);
    expect(result.credit).toMatchObject({
      status: "credited",
      durationMinutes: 30,
      distanceKm: 5,
      workload: { basis: "duration_x_rpe", value: 120 },
    });
    expect(result.raceSync.status).toBe("deferred");
    expect(deps.sync).toHaveBeenCalledWith(b.client, USER, { workoutSessionId: RUN });
    expect(b.fetch).toHaveBeenCalledTimes(1);
  });
  it("a refused insert fails the primary action and never attempts enrichment", async () => {
    const b = boundary(true);
    await expect(recordEnduranceActivity(b.client, USER, activity)).rejects.toMatchObject({
      code: "42501",
    });
    expect(deps.sync).not.toHaveBeenCalled();
  });
  it("walking remains training without claiming a race-plan match", async () => {
    const b = boundary();
    const result = await recordEnduranceActivity(b.client, USER, { ...activity, kind: "walk" });
    expect(result.raceSync.status).toBe("not_applicable");
    expect(result.credit.status).toBe("credited");
    expect(deps.sync).not.toHaveBeenCalled();
  });
  it("rejects future completion before any write", async () => {
    const b = boundary();
    await expect(
      recordEnduranceActivity(b.client, USER, { ...activity, startedAt: "2099-01-01T00:00:00Z" }),
    ).rejects.toThrow("future");
    expect(b.fetch).not.toHaveBeenCalled();
  });
});
