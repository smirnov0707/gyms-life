import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Mesh } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { loadTwinHuman, twinHumanUrl } from "./twin-human.loader";
import { TWIN_REGISTERED_ASSETS, verifyTwinAsset } from "./twin-body.provenance";

const bytesOf = async (path: string) => new Uint8Array(await readFile(path)).buffer;
const nativePath = "tests/twin-browser/assets/twin-anatomy-muscular-candidate.glb";
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Twin asset provenance", () => {
  it("loads the selected surface with its exact region mapping and keeps Body separate", async () => {
    const url = twinHumanUrl("male");
    expect(url).toBe("/models/twin-natural-v1.glb");
    expect(twinHumanUrl("female")).toBe(url);
    expect(twinHumanUrl("male", "realistic")).toBe("/models/twin-body-v2.glb");
    const bytes = await bytesOf(`public${url}`);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(bytes)),
    );
    const model = await loadTwinHuman(url);
    expect([...model.regionMeshes.keys()].sort()).toEqual([
      "abs",
      "arms",
      "back",
      "chest",
      "core",
      "glutes",
      "legs",
      "shoulders",
    ]);
    expect(model.provenance.sha256).toBe(
      "6dba27f71bf62e61eccf3e115ea9e183e37f0c00d6846a13f5a02705d5012c1d",
    );
    expect(model.provenance.candidate).toBe(false);
    for (const meshes of model.regionMeshes.values()) {
      for (const mesh of meshes) {
        expect(mesh.geometry.getAttribute("_twin_mask")?.itemSize).toBe(1);
        expect(mesh.geometry.getAttribute("_twin_sculpt_position")?.itemSize).toBe(3);
      }
    }
    model.dispose();
  });
  it.each(TWIN_REGISTERED_ASSETS)("verifies the exact bytes of $path", async (asset) => {
    const result = await verifyTwinAsset(await bytesOf(asset.path));
    expect(result.sha256).toBe(asset.sha256);
    expect(result.source).toBe(asset.source);
    expect(result.candidate).toBe(asset.candidate);
    expect(result.credit).toContain(asset.source === "makehuman" ? "MakeHuman" : "BodyParts3D");
  });
  it("rejects HTML or a stale/tampered asset instead of guessing its source from the URL", async () => {
    await expect(
      verifyTwinAsset(new TextEncoder().encode("<!doctype html>not a model").buffer),
    ).rejects.toThrow(/GLB/);
    const changed = new Uint8Array(await bytesOf(nativePath));
    changed[changed.length - 1] = changed[changed.length - 1]! ^ 1;
    await expect(verifyTwinAsset(changed.buffer)).rejects.toThrow(/Unregistered/);
  });
  it("uses the downloaded model source rather than the requested filename", async () => {
    const bytes = await bytesOf(nativePath);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(bytes)),
    );
    const model = await loadTwinHuman("/models/twin-anatomy-v1.glb");
    expect(model.provenance.source).toBe("makehuman");
    expect(model.provenance.candidate).toBe(true);
    expect(model.regionMeshes.size).toBe(8);
    model.dispose();
    expect(model.meshes).toHaveLength(0);
  });
  it("does not parse a failed or unverifiable asset response", async () => {
    const parse = vi.spyOn(GLTFLoader.prototype, "parseAsync");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("failed", { status: 503 }))
        .mockResolvedValueOnce(new Response("bad", { headers: { "content-length": "9000000" } }))
        .mockResolvedValueOnce(new Response("not a real model document")),
    );
    await expect(loadTwinHuman("/model.glb")).rejects.toThrow(/503/);
    await expect(loadTwinHuman("/model.glb")).rejects.toThrow(/size/);
    await expect(loadTwinHuman("/model.glb")).rejects.toThrow(/GLB/);
    expect(parse).not.toHaveBeenCalled();
  });
  it("does not fetch after cancellation", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();
    controller.abort();
    await expect(loadTwinHuman("/model.glb", controller.signal)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("forwards scene cancellation to the network request", async () => {
    const controller = new AbortController();
    const fetch = vi.fn(
      (_url: string, options: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          options.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Cancelled", "AbortError")),
            { once: true },
          );
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const pending = loadTwinHuman("/model.glb", controller.signal);
    const rejection = expect(pending).rejects.toThrow("Cancelled");
    controller.abort();
    await rejection;
    expect(fetch).toHaveBeenCalledWith("/model.glb", { signal: controller.signal });
  });
  it("disposes a model when cancellation arrives during parsing", async () => {
    const bytes = await bytesOf(nativePath);
    const gltf = await new GLTFLoader().parseAsync(bytes, "");
    const surfaces: Mesh[] = [];
    gltf.scene.traverse((object) => {
      if (object instanceof Mesh) surfaces.push(object);
    });
    const disposed = surfaces.map((mesh) => vi.spyOn(mesh.geometry, "dispose"));
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(bytes)),
    );
    vi.spyOn(GLTFLoader.prototype, "parseAsync").mockImplementationOnce(async () => {
      controller.abort();
      return gltf;
    });
    await expect(loadTwinHuman("/model.glb", controller.signal)).rejects.toThrow();
    expect(disposed.length).toBeGreaterThan(0);
    for (const dispose of disposed) expect(dispose).toHaveBeenCalledOnce();
  });
});
