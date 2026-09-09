import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), review: vi.fn(), event: vi.fn(), run: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: mocks.from } }));
vi.mock("./night-review.server", () => ({ runAthleteNightReview: mocks.review }));
vi.mock("./personal-timeline.server", () => ({ recordPersonalTimelineEvent: mocks.event }));
vi.mock("./background-job.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./background-job.server")>()),
  runBackgroundJob: mocks.run,
}));
import { runNightLab } from "./night-lab.server";
const USER = "11111111-1111-4111-8111-111111111111",
  SECOND = "22222222-2222-4222-8222-222222222222",
  ID = "33333333-3333-4333-8333-333333333333",
  NOW = "2026-09-09T06:00:00Z";
const context = {
  runId: ID,
  runKey: "2026-09-09",
  claimedAt: NOW,
  window: { start: "2026-09-02T06:00:00Z", end: NOW },
  limit: 40,
};
const prediction = {
  id: ID,
  target: "workout_completion",
  generatedAt: "2026-09-08T08:00:00Z",
  horizonEndsAt: "2026-09-08T20:59:59Z",
  modelId: "completion",
  modelVersion: "1.0",
  maturity: "shadow",
  athleteStateSnapshotId: ID,
  evidenceLevel: "early",
  evidence: [],
  predicted: { kind: "probability", value: 0.6 },
  actual: null,
  evaluatedAt: null,
};
function sources(rows: Record<string, unknown>, fail?: string) {
  mocks.from.mockImplementation((table: string) => {
    const result = Promise.resolve({
      data:
        table === "profiles"
          ? (rows["profiles"] ?? { time_zone: "Europe/Vilnius" })
          : (rows[table] ?? []),
      error: table === fail ? { message: "private" } : null,
    });
    const query = new Proxy(
      {},
      { get: (_t, key) => (key === "then" ? result.then.bind(result) : () => query) },
    );
    return query;
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.run.mockImplementation(async (_name, work) => work(context));
  mocks.event.mockResolvedValue(undefined);
  mocks.review.mockResolvedValue({
    id: ID,
    review: { status: "completed", snapshot: { status: "confirmed", id: ID }, reviewedAt: NOW },
  });
  sources({});
});
describe("Night Lab real worker control flow", () => {
  it("a quiet readable scan performs no invented athlete work", async () => {
    expect(await runNightLab()).toEqual([]);
    expect(mocks.review).not.toHaveBeenCalled();
    expect(mocks.event).not.toHaveBeenCalled();
  });
  it("a matured pending forecast schedules review even without a new workout", async () => {
    sources({ decision_records: [{ user_id: USER, prediction }] });
    expect(await runNightLab()).toEqual([{ ok: true }]);
    expect(mocks.review).toHaveBeenCalledWith(expect.anything(), {
      userId: USER,
      runId: ID,
      runKey: context.runKey,
      claimedAt: NOW,
      evidenceThrough: NOW,
      timeZone: "Europe/Vilnius",
    });
  });
  it("does not schedule an open future forecast merely because it exists", async () => {
    sources({
      decision_records: [
        { user_id: USER, prediction: { ...prediction, horizonEndsAt: "2026-09-10T20:00:00Z" } },
      ],
    });
    expect(await runNightLab()).toEqual([]);
  });
  it("a blocked snapshot cannot create a falsely successful twin_recalculated marker", async () => {
    sources({ workout_sessions: [{ user_id: USER, finished_at: "2026-09-08T20:00:00Z" }] });
    mocks.review.mockResolvedValue({
      id: ID,
      review: { status: "blocked", snapshot: { status: "blocked" }, reviewedAt: NOW },
    });
    expect(await runNightLab()).toEqual([{ ok: false }]);
    expect(mocks.event).not.toHaveBeenCalled();
  });
  it("partial work is recorded as incomplete even if a valid snapshot exists", async () => {
    sources({ health_samples: [{ user_id: USER, updated_at: NOW }] });
    mocks.review.mockResolvedValue({
      id: ID,
      review: { status: "partial", snapshot: { status: "confirmed", id: ID }, reviewedAt: NOW },
    });
    expect(await runNightLab()).toEqual([{ ok: false }]);
    expect(mocks.event).toHaveBeenCalledWith(
      USER,
      expect.objectContaining({
        summary: { job: "night_lab", reviewId: ID, snapshotId: ID, reviewStatus: "partial" },
      }),
    );
  });
  it("one athlete's review failure does not suppress another confirmed report", async () => {
    sources({
      workout_sessions: [
        { user_id: USER, finished_at: NOW },
        { user_id: SECOND, finished_at: NOW },
      ],
    });
    mocks.review.mockRejectedValueOnce(new Error("private"));
    const result = await runNightLab();
    expect(result).toEqual([{ ok: false }, { ok: true }]);
    expect(mocks.review).toHaveBeenCalledTimes(2);
  });
  it.each(["health_samples", "workout_sessions", "decision_records"])(
    "an unreadable %s selection is not a full successful scan",
    async (table) => {
      sources({}, table);
      await expect(runNightLab()).rejects.toThrow("EVIDENCE_UNREADABLE_OR_TRUNCATED");
      expect(mocks.review).not.toHaveBeenCalled();
    },
  );
  it("selection truncation is explicit instead of silently excluding eligible athletes", async () => {
    sources({
      health_samples: Array.from({ length: 501 }, () => ({ user_id: USER, updated_at: NOW })),
    });
    await expect(runNightLab()).rejects.toThrow("EVIDENCE_UNREADABLE_OR_TRUNCATED");
  });
  it("an unknown athlete time zone is not substituted with UTC", async () => {
    sources({
      workout_sessions: [{ user_id: USER, finished_at: NOW }],
      profiles: { time_zone: "Not/AZone" },
    });
    expect(await runNightLab()).toEqual([{ ok: false }]);
    expect(mocks.review).not.toHaveBeenCalled();
  });
});
