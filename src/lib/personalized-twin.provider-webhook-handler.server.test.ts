import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { handleThreeDLookPersonalizedTwinWebhook } from "./personalized-twin.provider-webhook-handler.server";
import type { ThreeDLookVerifiedContract } from "./personalized-twin.provider-3dlook.server";

const contract: ThreeDLookVerifiedContract = {
  apiBaseUrl: "https://provider.example",
  apiToken: "token",
  apiKeyHeader: "x-api-key",
  submitPath: "/submit",
  statusPathTemplate: "/jobs/{jobId}",
  modelPathTemplate: "/jobs/{jobId}/model",
  webhookSignatureHeader: "x-signature",
  webhookSecret: "secret",
  webhookAlgorithm: "sha256",
};

function signedRequest(payload: unknown, valid = true) {
  const body = JSON.stringify(payload);
  const signature = createHmac("sha256", contract.webhookSecret).update(body).digest("hex");
  return new Request("https://example.invalid/api/public/personalized-twin/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "x-signature": valid ? signature : "bad" },
    body,
  });
}

describe("Personalized Twin provider webhook handler", () => {
  it("rejects invalid signatures before payload handling", async () => {
    const response = await handleThreeDLookPersonalizedTwinWebhook(
      signedRequest(
        { eventId: "e1", providerJobId: "j1", payload: { status: "processing" } },
        false,
      ),
      contract,
    );
    expect(response.status).toBe(401);
  });

  it("accepts a verified processing heartbeat without terminalizing", async () => {
    const response = await handleThreeDLookPersonalizedTwinWebhook(
      signedRequest({ eventId: "e1", providerJobId: "j1", payload: { status: "processing" } }),
      contract,
    );
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ accepted: true, outcome: "processing" });
  });
});
