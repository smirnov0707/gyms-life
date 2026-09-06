import { readFileSync } from "node:fs";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, DataTexture } from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import candidate from "./human-asset.candidate.json";
import { disposeHumanScene, loadHumanBody } from "./human-body.loader";
const { parseAsync } = vi.hoisted(() => ({ parseAsync: vi.fn() }));
vi.mock("three/addons/loaders/GLTFLoader.js", () => ({ GLTFLoader: class { parseAsync = parseAsync; } }));
const bytes = Uint8Array.from(readFileSync(`public${candidate.url}`));
function ownedScene() {
  const root = new Group();
  const texture = new DataTexture(new Uint8Array(16), 2, 2);
  const material = new MeshStandardMaterial({ map: texture });
  const geometry = new BoxGeometry(0.5, 1.8, 0.25);
  const mesh = new Mesh(geometry, material); mesh.position.y = 0.9;
  mesh.userData["twinRegion"] = "chest";
  root.add(mesh);
  return { root, material, texture, geometry, mesh };
}
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(bytes)));
  parseAsync.mockReset();
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe("human loader ownership and failure paths", () => {
  it("does not parse a 404 or a hash mismatch", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("missing", { status: 404 })));
    await expect(loadHumanBody(candidate, new AbortController().signal)).rejects.toThrow();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array(bytes.byteLength))));
    await expect(loadHumanBody(candidate, new AbortController().signal)).rejects.toThrow("integrity");
    expect(parseAsync).not.toHaveBeenCalled();
  });
  it("rejects malformed decoding rather than claiming a human is ready", async () => {
    parseAsync.mockRejectedValue(new Error("decode failed"));
    await expect(loadHumanBody(candidate, new AbortController().signal)).rejects.toThrow("decode");
  });
  it("disposes a resolved scene if the request was cancelled during parsing", async () => {
    const own = ownedScene(); const release = vi.spyOn(own.texture, "dispose");
    const controller = new AbortController();
    parseAsync.mockImplementation(async () => { controller.abort(); return { scene: own.root }; });
    await expect(loadHumanBody(candidate, controller.signal)).rejects.toThrow();
    expect(release).toHaveBeenCalledTimes(1); expect(own.root.children).toHaveLength(0);
  });
  it("rejects a model missing its actual decoded texture", async () => {
    const own = ownedScene(); own.material.map = null;
    parseAsync.mockResolvedValue({ scene: own.root });
    await expect(loadHumanBody(candidate, new AbortController().signal)).rejects.toThrow("textured");
    expect(own.root.children).toHaveLength(0);
  });
  it("releases owned resources once and never a separate scene", async () => {
    const own = ownedScene(); const other = ownedScene();
    const geometry = vi.spyOn(own.geometry, "dispose"); const material = vi.spyOn(own.material, "dispose");
    const texture = vi.spyOn(own.texture, "dispose"); const unrelated = vi.spyOn(other.texture, "dispose");
    parseAsync.mockResolvedValue({ scene: own.root });
    const handle = await loadHumanBody(candidate, new AbortController().signal);
    expect(handle.regionOf.get(own.mesh)).toBe("chest");
    handle.dispose(); handle.dispose();
    expect(geometry).toHaveBeenCalledTimes(1); expect(material).toHaveBeenCalledTimes(1);
    expect(texture).toHaveBeenCalledTimes(1); expect(unrelated).not.toHaveBeenCalled();
    disposeHumanScene(other.root);
  });
});
