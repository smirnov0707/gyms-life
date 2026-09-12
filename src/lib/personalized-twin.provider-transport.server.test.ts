import { describe, expect, it, vi } from "vitest";
import {
  assertProviderUrlAllowed,
  fetchPersonalizedTwinModel,
} from "./personalized-twin.provider-transport.server";

const gate = { enabled: true as const, allowedOrigin: "https://provider.example" };

describe("Personalized Twin provider transport", () => {
  it("fails closed when network is not explicitly enabled", async () => {
    const fetchImpl = vi.fn();
    await expect(
      fetchPersonalizedTwinModel({
        url: "https://provider.example/model.glb",
        gate: null,
        fetchImpl,
      }),
    ).rejects.toThrow("PERSONALIZED_TWIN_PROVIDER_NETWORK_DISABLED");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("blocks non-HTTPS and cross-origin model URLs", () => {
    expect(() => assertProviderUrlAllowed("http://provider.example/model.glb", gate)).toThrow(
      "PERSONALIZED_TWIN_PROVIDER_HTTPS_REQUIRED",
    );
    expect(() => assertProviderUrlAllowed("https://evil.example/model.glb", gate)).toThrow(
      "PERSONALIZED_TWIN_PROVIDER_ORIGIN_BLOCKED",
    );
  });

  it("accepts only bounded GLB/octet-stream responses", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const fetchImpl = vi.fn(
      async () =>
        new Response(bytes, {
          status: 200,
          headers: { "content-type": "model/gltf-binary", "content-length": String(bytes.length) },
        }),
    );
    await expect(
      fetchPersonalizedTwinModel({ url: "https://provider.example/model.glb", gate, fetchImpl }),
    ).resolves.toEqual(bytes);
  });
});
