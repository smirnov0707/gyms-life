import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadTwinIdentityShell } from "./twin-identity-shell.loader";

afterEach(() => vi.unstubAllGlobals());

describe("Personalized Twin identity shell loader", () => {
  it("loads a valid GLB without inventing evidence regions", async () => {
    const bytes = await readFile("public/models/twin-body-v2.glb");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(bytes, {
            status: 200,
            headers: {
              "content-type": "model/gltf-binary",
              "content-length": String(bytes.byteLength),
            },
          }),
      ),
    );
    const model = await loadTwinIdentityShell("https://signed.example/model.glb");
    expect(model.meshes.length).toBeGreaterThan(0);
    expect(model.regionMeshes.size).toBe(0);
    expect(model.regionOf.size).toBe(0);
    expect(model.baseColorOf.size).toBe(0);
    expect(fetch).toHaveBeenCalledWith("https://signed.example/model.glb", {
      signal: null,
      credentials: "omit",
    });
    model.dispose();
  });

  it("rejects bytes that are not a GLB", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array(32), { status: 200 })),
    );
    await expect(loadTwinIdentityShell("https://signed.example/not-glb")).rejects.toThrow(
      "PERSONALIZED_TWIN_IDENTITY_MODEL_GLB_INVALID",
    );
  });
});
