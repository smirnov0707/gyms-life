import { describe, expect, it, vi } from "vitest";
import { processPersonalizedTwinProviderJob } from "./personalized-twin.provider-job.service";
import type { PersonalizedTwinReconstructionProvider } from "./personalized-twin.provider";

const job = {
  captureSetId: "capture-1",
  providerKey: "provider-x",
  providerJobId: "job-1",
  status: "processing" as const,
  pollAttempt: 0,
  nextPollAt: null,
  terminalLeaseUntil: null,
};

function deps(result: Awaited<ReturnType<PersonalizedTwinReconstructionProvider["poll"]>>) {
  const provider: PersonalizedTwinReconstructionProvider = {
    key: "provider-x",
    submit: vi.fn(),
    poll: vi.fn().mockResolvedValue(result),
  };
  const persistence = {
    scheduleNextPoll: vi.fn(),
    acquireTerminalLease: vi.fn().mockResolvedValue("acquired"),
    releaseTerminalLease: vi.fn(),
    markReady: vi.fn(),
    markFailed: vi.fn(),
  };
  const storage = {
    putModel: vi.fn(),
    removeInputs: vi.fn(),
    removeModels: vi.fn(),
  };
  return { provider, persistence, storage };
}
describe("Personalized Twin provider job orchestration", () => {
  it("schedules processing jobs with backoff", async () => {
    const { provider, persistence, storage } = deps({ status: "processing" });
    await expect(
      processPersonalizedTwinProviderJob({
        userId: "user-1",
        job,
        rawInputPaths: [],
        provider,
        persistence,
        storage,
        now: () => new Date("2026-09-11T12:00:00.000Z"),
      }),
    ).resolves.toBe("processing");
    expect(persistence.scheduleNextPoll).toHaveBeenCalledWith({
      captureSetId: "capture-1",
      providerJobId: "job-1",
      pollAttempt: 1,
      nextPollAt: "2026-09-11T12:00:10.000Z",
    });
    expect(persistence.acquireTerminalLease).not.toHaveBeenCalled();
  });

  it("allows only one terminalizer to finalize a ready job", async () => {
    const { provider, persistence, storage } = deps({
      status: "ready",
      modelBytes: new Uint8Array([1, 2, 3]),
      contentType: "model/gltf-binary",
    });
    persistence.acquireTerminalLease.mockResolvedValue("busy");
    await expect(
      processPersonalizedTwinProviderJob({
        userId: "user-1",
        job,
        rawInputPaths: ["raw/front.jpg"],
        provider,
        persistence,
        storage,
        now: () => new Date("2026-09-11T12:00:00.000Z"),
      }),
    ).resolves.toBe("skipped");
    expect(storage.putModel).not.toHaveBeenCalled();
    expect(persistence.markReady).not.toHaveBeenCalled();
  });

  it("finalizes once after acquiring the terminal lease", async () => {
    const { provider, persistence, storage } = deps({
      status: "failed",
      errorCode: "provider_failed",
    });
    await expect(
      processPersonalizedTwinProviderJob({
        userId: "user-1",
        job,
        rawInputPaths: ["raw/front.jpg"],
        provider,
        persistence,
        storage,
        now: () => new Date("2026-09-11T12:00:00.000Z"),
      }),
    ).resolves.toBe("terminalized");
    expect(storage.removeInputs).toHaveBeenCalledWith(["raw/front.jpg"]);
    expect(persistence.markFailed).toHaveBeenCalledTimes(1);
  });
});
