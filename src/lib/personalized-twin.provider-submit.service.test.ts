import { describe, expect, it, vi } from "vitest";
import { submitPersonalizedTwinToProvider } from "./personalized-twin.provider-submit.service";
import type { PersonalizedTwinProviderCapability } from "./personalized-twin.provider";

const capability: PersonalizedTwinProviderCapability = {
  available: true,
  providerKey: "reviewed-provider",
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
const providerInputs = [
  {
    angle: "front" as const,
    url: "https://signed.example/front",
    expiresAt: "2026-09-11T12:00:00Z",
  },
  { angle: "side" as const, url: "https://signed.example/side", expiresAt: "2026-09-11T12:00:00Z" },
  { angle: "back" as const, url: "https://signed.example/back", expiresAt: "2026-09-11T12:00:00Z" },
];

describe("Personalized Twin provider submission", () => {
  it("does not call the provider while governance is blocked", async () => {
    const submit = vi.fn();
    await expect(
      submitPersonalizedTwinToProvider({
        userId: "user-1",
        captureSetId: "capture-1",
        capability: { ...capability, available: false },
        review,
        provider: { key: "reviewed-provider", submit, poll: vi.fn() },
        providerInputs,
        persistence: { markProcessing: vi.fn() },
      }),
    ).rejects.toThrow("PERSONALIZED_TWIN_PROVIDER_BLOCKED");
    expect(submit).not.toHaveBeenCalled();
  });

  it("rejects duplicate provider views before any external call", async () => {
    const submit = vi.fn();
    await expect(
      submitPersonalizedTwinToProvider({
        userId: "user-1",
        captureSetId: "capture-1",
        capability,
        review,
        provider: { key: "reviewed-provider", submit, poll: vi.fn() },
        providerInputs: [providerInputs[0]!, providerInputs[0]!, providerInputs[2]!],
        persistence: { markProcessing: vi.fn() },
      }),
    ).rejects.toThrow("PERSONALIZED_TWIN_PROVIDER_INPUTS_REQUIRED");
    expect(submit).not.toHaveBeenCalled();
  });

  it("keeps GYMS.LIFE user identity out of the provider request", async () => {
    const submit = vi.fn().mockResolvedValue({ providerJobId: "job-1" });
    const markProcessing = vi.fn().mockResolvedValue(undefined);
    await submitPersonalizedTwinToProvider({
      userId: "internal-user-1",
      captureSetId: "capture-1",
      capability,
      review,
      provider: { key: "reviewed-provider", submit, poll: vi.fn() },
      providerInputs,
      persistence: { markProcessing },
    });
    expect(submit).toHaveBeenCalledWith({ captureReference: "capture-1", inputs: providerInputs });
    expect(JSON.stringify(submit.mock.calls[0])).not.toContain("internal-user-1");
    expect(markProcessing).toHaveBeenCalledWith({
      userId: "internal-user-1",
      captureSetId: "capture-1",
      providerKey: "reviewed-provider",
      providerJobId: "job-1",
    });
  });
});
