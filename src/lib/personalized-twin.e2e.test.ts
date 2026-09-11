import { describe, expect, it, vi } from "vitest";
import { submitPersonalizedTwinToProvider } from "./personalized-twin.provider-submit.service";
import { processPersonalizedTwinProviderJob } from "./personalized-twin.provider-job.service";
import type {
  PersonalizedTwinProviderCapability,
  PersonalizedTwinReconstructionProvider,
} from "./personalized-twin.provider";

const capability: PersonalizedTwinProviderCapability = {
  available: true,
  providerKey: "mock-provider",
  candidate: "in3d",
  captureModes: ["three_view"],
  outputFormat: "glb",
  externalProcessing: true,
  privacyReview: "approved",
  medicalScan: false,
};

const review = {
  dpaApproved: true,
  retentionApproved: true,
  trainingUseProhibited: true,
  userDeletionSupported: true,
  transferRiskApproved: true,
  captureConsentVersion: "personalized_twin_v1" as const,
};

describe("Personalized Twin end-to-end orchestration", () => {
  it("submits once, polls, stores GLB, deletes raw inputs and terminalizes ready", async () => {
    const state = {
      status: "ready_for_provider",
      providerJobId: null as string | null,
      modelPath: null as string | null,
    };
    const rawInputs = ["u/c/front.jpg", "u/c/side.jpg", "u/c/back.jpg"];
    const storedModels: string[] = [];
    const removedInputs: string[] = [];
    const provider: PersonalizedTwinReconstructionProvider = {
      key: "mock-provider",
      submit: vi.fn().mockResolvedValue({ providerJobId: "job-1" }),
      poll: vi.fn().mockResolvedValue({
        status: "ready",
        modelBytes: new Uint8Array([103, 108, 84, 70]),
        contentType: "model/gltf-binary",
      }),
    };

    const submissionPersistence = {
      claimSubmission: vi.fn(async () =>
        state.providerJobId ? { providerJobId: state.providerJobId } : ("claimed" as const),
      ),
      releaseSubmissionClaim: vi.fn(async () => undefined),
      markProcessing: vi.fn(async ({ providerJobId }: { providerJobId: string }) => {
        state.status = "processing";
        state.providerJobId = providerJobId;
      }),
    };
    const submitted = await submitPersonalizedTwinToProvider({
      userId: "internal-user",
      captureSetId: "capture-1",
      capability,
      review,
      provider,
      providerInputs: ["front", "side", "back"].map((angle) => ({
        angle: angle as "front" | "side" | "back",
        url: `https://signed/${angle}`,
        expiresAt: "2026-09-11T16:00:00Z",
      })),
      persistence: submissionPersistence,
      claimToken: "claim-1",
      now: () => new Date("2026-09-11T15:00:00Z"),
    });
    expect(submitted).toEqual({ providerJobId: "job-1", reused: false });
    expect(provider.submit).toHaveBeenCalledTimes(1);

    const persistence = {
      scheduleNextPoll: vi.fn(async () => undefined),
      acquireTerminalLease: vi.fn(async () => "acquired" as const),
      releaseTerminalLease: vi.fn(async () => undefined),
      markReady: vi.fn(async ({ modelObjectPath }: { modelObjectPath: string }) => {
        state.status = "ready";
        state.modelPath = modelObjectPath;
      }),
      markFailed: vi.fn(async () => undefined),
    };
    const storage = {
      putModel: vi.fn(async ({ path }: { path: string }) => {
        storedModels.push(path);
      }),
      removeInputs: vi.fn(async (paths: readonly string[]) => {
        removedInputs.push(...paths);
      }),
      removeModels: vi.fn(async () => undefined),
    };
    const result = await processPersonalizedTwinProviderJob({
      userId: "internal-user",
      job: {
        captureSetId: "capture-1",
        providerKey: "mock-provider",
        providerJobId: "job-1",
        status: "processing",
        pollAttempt: 0,
        nextPollAt: null,
        terminalLeaseUntil: null,
      },
      rawInputPaths: rawInputs,
      provider,
      persistence,
      storage,
      now: () => new Date("2026-09-11T15:01:00Z"),
    });
    expect(result).toBe("terminalized");
    expect(state.status).toBe("ready");
    expect(state.modelPath).toBe("internal-user/capture-1/avatar.glb");
    expect(storedModels).toEqual(["internal-user/capture-1/avatar.glb"]);
    expect(removedInputs).toEqual(rawInputs);
  });
});
