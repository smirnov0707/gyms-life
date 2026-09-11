import { describe, expect, it, vi } from "vitest";
import { acceptPersonalizedTwinProviderResult } from "./personalized-twin.provider-result.service";

function deps() {
  return {
    persistence: {
      claimProviderEvent: vi.fn().mockResolvedValue("claimed"),
      acquireTerminalLease: vi.fn().mockResolvedValue("acquired"),
      releaseTerminalLease: vi.fn(),
      markReady: vi.fn(),
      markFailed: vi.fn(),
    },
    storage: {
      putModel: vi.fn(),
      removeInputs: vi.fn(),
      removeModels: vi.fn(),
    },
  };
}
describe("Personalized Twin provider result reconciliation", () => {
  it("deduplicates repeated webhook events before terminalization", async () => {
    const { persistence, storage } = deps();
    persistence.claimProviderEvent.mockResolvedValue("duplicate");
    await expect(
      acceptPersonalizedTwinProviderResult({
        userId: "user-1",
        captureSetId: "capture-1",
        providerKey: "provider-x",
        providerJobId: "job-1",
        eventKey: "event-1",
        rawInputPaths: [],
        result: { status: "failed", errorCode: "provider_failed" },
        persistence,
        storage,
      }),
    ).resolves.toBe("duplicate");
    expect(persistence.acquireTerminalLease).not.toHaveBeenCalled();
    expect(persistence.markFailed).not.toHaveBeenCalled();
  });

  it("shares the terminal lease with polling so only one path can finish", async () => {
    const { persistence, storage } = deps();
    persistence.acquireTerminalLease.mockResolvedValue("busy");
    await expect(
      acceptPersonalizedTwinProviderResult({
        userId: "user-1",
        captureSetId: "capture-1",
        providerKey: "provider-x",
        providerJobId: "job-1",
        eventKey: "event-2",
        rawInputPaths: [],
        result: { status: "failed", errorCode: "provider_failed" },
        persistence,
        storage,
      }),
    ).resolves.toBe("busy");
    expect(persistence.markFailed).not.toHaveBeenCalled();
  });
});
