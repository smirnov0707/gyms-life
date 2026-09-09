import { beforeEach, describe, expect, it, vi } from "vitest";
const io = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: io.from } }));
import { runBackgroundJob } from "./background-job.server";
import { nightLabHttpStatus } from "./night-lab.http";
const now = new Date("2026-09-09T12:00:00.000Z"),
  old = "2026-09-08T12:00:00.000Z",
  ID = "11111111-1111-4111-8111-111111111111";
type Answer = { data: unknown; error: unknown };
function prepare(answers: Answer[]) {
  const calls: { table: string; operations: [string, unknown[]][] }[] = [];
  io.from.mockImplementation((table: string) => {
    const row = { table, operations: [] as [string, unknown[]][] };
    calls.push(row);
    const response = Promise.resolve(answers.shift());
    const query = new Proxy(
      {},
      {
        get: (_t, key) =>
          key === "then"
            ? response.then.bind(response)
            : (...args: unknown[]) => {
                row.operations.push([String(key), args]);
                return query;
              },
      },
    );
    return query;
  });
  return calls;
}
const ok = (data: unknown) => ({ data, error: null });
beforeEach(() => vi.clearAllMocks());
describe("background worker ownership and acknowledgement", () => {
  it("cannot fabricate an evidence window when a legacy claim row cannot be decoded", async () => {
    prepare([ok({ id: ID, status: "running", started_at: old })]);
    const work = vi.fn();
    expect((await runBackgroundJob("night_lab", work, { now })).status).toBe("unavailable");
    expect(work).not.toHaveBeenCalled();
  });

  it("reclaims only the exact expired lease, and closes only its own lease", async () => {
    const calls = prepare([
      ok({
        id: ID,
        status: "running",
        started_at: old,
        window_start: "2026-09-01T12:00:00.000Z",
        window_end: "2026-09-08T12:00:00.000Z",
      }),
      ok({ id: ID }),
      ok({ id: ID }),
    ]);
    const work = vi.fn().mockResolvedValue([{ ok: true }]);
    const report = await runBackgroundJob("night_lab", work, { now });
    expect(calls[1]?.operations).toContainEqual(["eq", ["started_at", old]]);
    expect(calls[2]?.operations).toContainEqual(["eq", ["started_at", now.toISOString()]]);
    expect(calls[2]?.operations).toContainEqual(["eq", ["status", "running"]]);
    expect(report).toMatchObject({ status: "ran", recorded: true, outcome: { succeeded: 1 } });
    expect(nightLabHttpStatus(report)).toBe(200);
    expect(work).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: ID,
        claimedAt: now.toISOString(),
        window: { start: "2026-09-01T12:00:00.000Z", end: "2026-09-08T12:00:00.000Z" },
      }),
    );
  });
  it("a worker that loses the compare-and-swap reclaim never executes the job", async () => {
    prepare([
      ok({
        id: ID,
        status: "running",
        started_at: old,
        window_start: "2026-09-01T12:00:00.000Z",
        window_end: "2026-09-08T12:00:00.000Z",
      }),
      ok(null),
    ]);
    const work = vi.fn();
    expect(await runBackgroundJob("night_lab", work, { now })).toMatchObject({ status: "skipped" });
    expect(work).not.toHaveBeenCalled();
  });
  it("a reclaim read/write error is unavailable, not another worker's success", async () => {
    prepare([
      ok({
        id: ID,
        status: "running",
        started_at: old,
        window_start: "2026-09-01T12:00:00.000Z",
        window_end: "2026-09-08T12:00:00.000Z",
      }),
      { data: null, error: { code: "synthetic" } },
    ]);
    const work = vi.fn();
    const report = await runBackgroundJob("night_lab", work, { now });
    expect(report.status).toBe("unavailable");
    expect(work).not.toHaveBeenCalled();
    expect(nightLabHttpStatus(report)).toBe(503);
  });
  it("a stale worker's zero-row close is not a recorded success", async () => {
    prepare([ok(null), ok({ id: ID }), ok(null)]);
    const report = await runBackgroundJob("night_lab", async () => [{ ok: true }], { now });
    expect(report).toMatchObject({ status: "ran", recorded: false });
    expect(nightLabHttpStatus(report)).toBe(503);
  });
  it("failed agent work is reported to the scheduler even if its failed ledger was written", async () => {
    prepare([ok(null), ok({ id: ID }), ok({ id: ID })]);
    const report = await runBackgroundJob(
      "night_lab",
      async () => {
        throw new Error("private user data must not be returned");
      },
      { now },
    );
    expect(report).toMatchObject({ status: "ran", recorded: true, outcome: { status: "failed" } });
    expect(JSON.stringify(report)).not.toContain("private");
    expect(nightLabHttpStatus(report)).toBe(503);
  });
  it("completed duplicate runs are a harmless skip", async () => {
    prepare([
      ok({
        id: ID,
        status: "succeeded",
        started_at: old,
        window_start: "2026-09-01T12:00:00.000Z",
        window_end: "2026-09-08T12:00:00.000Z",
      }),
    ]);
    const work = vi.fn();
    const report = await runBackgroundJob("night_lab", work, { now });
    expect(report.status).toBe("skipped");
    expect(work).not.toHaveBeenCalled();
    expect(nightLabHttpStatus(report)).toBe(200);
  });
  it("a missing successful-insert row cannot start work without a ledger", async () => {
    prepare([ok(null), ok(null)]);
    const work = vi.fn();
    expect((await runBackgroundJob("night_lab", work, { now })).status).toBe("unavailable");
    expect(work).not.toHaveBeenCalled();
  });
});
