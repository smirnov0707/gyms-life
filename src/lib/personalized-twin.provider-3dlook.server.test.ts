import { describe, expect, it } from "vitest";
import {
  ThreeDLookPersonalizedTwinProvider,
  ThreeDLookVerifiedContractSchema,
  verifyThreeDLookWebhook,
} from "./personalized-twin.provider-3dlook.server";

const contract = ThreeDLookVerifiedContractSchema.parse({
  apiBaseUrl: "https://api.vendor.example",
  apiToken: "secret-token",
  apiKeyHeader: "X-Api-Key",
  submitPath: "/scans",
  statusPathTemplate: "/scans/{jobId}",
  modelPathTemplate: "/scans/{jobId}/model",
  webhookSignatureHeader: "X-Signature",
  webhookSecret: "webhook-secret",
  webhookAlgorithm: "sha256",
});

describe("3DLOOK Personalized Twin adapter boundary", () => {
  it("fails closed when the vendor contract is not verified", async () => {
    const provider = new ThreeDLookPersonalizedTwinProvider(null);
    await expect(provider.poll("job-1")).rejects.toThrow(
      "PERSONALIZED_TWIN_3DLOOK_CONTRACT_UNVERIFIED",
    );
  });

  it("still blocks network calls even with a verified contract until DPA approval", async () => {
    const provider = new ThreeDLookPersonalizedTwinProvider(contract);
    await expect(provider.poll("job-1")).rejects.toThrow(
      "PERSONALIZED_TWIN_3DLOOK_NETWORK_DISABLED_PENDING_DPA",
    );
  });

  it("verifies webhook signatures with constant-time comparison", async () => {
    const { createHmac } = await import("node:crypto");
    const body = new TextEncoder().encode('{"event":"ready"}');
    const signature = createHmac("sha256", contract.webhookSecret).update(body).digest("hex");
    expect(verifyThreeDLookWebhook({ body, signature, contract })).toBe(true);
    expect(verifyThreeDLookWebhook({ body, signature: "0".repeat(64), contract })).toBe(false);
  });
});
