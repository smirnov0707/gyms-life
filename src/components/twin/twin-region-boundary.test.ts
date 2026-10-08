import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  PlaneGeometry,
  ShaderLib,
  type WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createTwinBoundaryField } from "./twin-region-boundary";
import { createTwinBoundaryMaterial } from "./twin-boundary.material";
import { loadTwinHuman } from "./twin-human.loader";
import { TWIN_SKIN_MATERIAL } from "./twin-surface.style";

afterEach(() => vi.unstubAllGlobals());
const buffer = (file: string) => new Uint8Array(readFileSync(file)).buffer;
const attributes = (geometry: BufferGeometry) =>
  Object.fromEntries(
    Object.entries(geometry.attributes).map(([name, attr]) => [name, Array.from(attr.array)]),
  );
describe("per-fragment posterior boundary field", () => {
  it("preserves every source position, normal, UV and triangle index", () => {
    const g = new PlaneGeometry(0.2, 0.2, 8, 8),
      before = attributes(g),
      index = Array.from(g.index!.array);
    const field = createTwinBoundaryField(g);
    expect(attributes(g)).toEqual(before);
    expect(Array.from(g.index!.array)).toEqual(index);
    expect(g.getAttribute("_twin_mask")).toBeUndefined();
    field.texture.dispose();
  });
  it("uses one bounded non-colour R8 field with a solid interior and neutral exterior", () => {
    const f = createTwinBoundaryField(new PlaneGeometry(0.2, 0.2, 8, 8));
    const data = f.texture.image.data;
    expect(data).toBeInstanceOf(Uint8Array);
    expect(data.byteLength).toBe(65536);
    expect(f.texture.image.width).toBe(256);
    expect(f.texture.image.height).toBe(256);
    expect(f.texture.colorSpace).toBe("");
    expect(f.texture.generateMipmaps).toBe(false);
    expect(data[128 * 256 + 128]).toBe(255);
    expect(data[0]).toBe(0);
    expect(Array.from(data).some((x) => x > 0 && x < 255)).toBe(true);
    f.texture.dispose();
  });
  it("gives identical fields for indexed and unindexed/UV-seamed geometry", () => {
    const g = new PlaneGeometry(0.2, 0.2, 8, 8);
    const a = createTwinBoundaryField(g),
      b = createTwinBoundaryField(g.toNonIndexed());
    expect(a.texture.image.data).toEqual(b.texture.image.data);
    a.texture.dispose();
    b.texture.dispose();
  });
  it.each([0, -0.1, NaN, Infinity, 0.2, 1e-9])("rejects invalid width %s", (width) => {
    expect(() => createTwinBoundaryField(new PlaneGeometry(), width)).toThrow("WIDTH_INVALID");
  });
  it("rejects invalid indices without changing the input", () => {
    const g = new PlaneGeometry(0.2, 0.2, 2, 2);
    g.setIndex([0, 1, 100]);
    expect(() => createTwinBoundaryField(g)).toThrow("INDEX_INVALID");
    expect(Array.from(g.index!.array)).toEqual([0, 1, 100]);
  });
  it("rejects nonfinite positions and empty projections", () => {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 0, 0, 0, 1, 0, 0], 3));
    expect(() => createTwinBoundaryField(g)).toThrow("PROJECTION_EMPTY");
    g.getAttribute("position").setX(0, NaN);
    expect(() => createTwinBoundaryField(g)).toThrow("POSITION_INVALID");
  });
  it("preserves the exact registered back and keeps a substantial interior", async () => {
    const gltf = await new GLTFLoader().parseAsync(buffer("public/models/twin-body-v2.glb"), "");
    const back: Mesh[] = [];
    gltf.scene.traverse((object) => {
      if (
        object instanceof Mesh &&
        !Array.isArray(object.material) &&
        object.material.name === "twin-region:back"
      )
        back.push(object);
    });
    expect(back).toHaveLength(1);
    const g = back[0]!.geometry,
      before = attributes(g),
      indices = Array.from(g.index!.array);
    const started = performance.now(),
      field = createTwinBoundaryField(g);
    const bytes = Array.from(field.texture.image.data);
    console.log("Boundary field CPU", {
      milliseconds: performance.now() - started,
      bytes: bytes.length,
      solid: bytes.filter((v) => v === 255).length,
    });
    expect(bytes.filter((v) => v === 255).length).toBeGreaterThan(1000);
    expect(bytes.filter((v) => v === 0).length).toBeGreaterThan(1000);
    expect(attributes(g)).toEqual(before);
    expect(Array.from(g.index!.array)).toEqual(indices);
    field.texture.dispose();
  });
  it("uses the field only on the verified realistic back, keeping all eight selectable regions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(buffer("public/models/twin-body-v2.glb"))),
    );
    const model = await loadTwinHuman("/models/twin-body-v2.glb", undefined, "realistic");
    for (const mesh of model.meshes) {
      if (Array.isArray(mesh.material)) throw new Error("Unexpected material array");
      expect(mesh.material.customProgramCacheKey().endsWith("-boundary-field-v1")).toBe(
        model.regionOf.get(mesh) === "back",
      );
      expect(mesh.geometry.getAttribute("_twin_mask")).toBeUndefined();
    }
    expect(model.regionMeshes.size).toBe(8);
    model.dispose();
    model.dispose();
  });
  it("preserves the analysis asset's authored masks exactly", async () => {
    const bytes = buffer("public/models/twin-selected-v1.glb");
    const gltf = await new GLTFLoader().parseAsync(bytes, "");
    const original: number[][] = [];
    gltf.scene.traverse((object) => {
      if (object instanceof Mesh) {
        const mask = object.geometry.getAttribute("_twin_mask");
        original.push(mask ? Array.from(mask.array) : []);
      }
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(bytes)),
    );
    const model = await loadTwinHuman("/models/twin-selected-v1.glb", undefined, "analysis");
    expect(
      model.meshes.map((mesh) => Array.from(mesh.geometry.getAttribute("_twin_mask").array)),
    ).toEqual(original);
    model.dispose();
  });
  it("releases the field exactly once with its owning material", () => {
    const field = createTwinBoundaryField(new PlaneGeometry(0.2, 0.2, 2, 2));
    const disposed = vi.fn();
    field.texture.addEventListener("dispose", disposed);
    const material = createTwinBoundaryMaterial(TWIN_SKIN_MATERIAL, field);
    material.dispose();
    material.dispose();
    expect(disposed).toHaveBeenCalledTimes(1);
  });
  it("keeps the existing emissive mask and restores neutral roughness at the boundary", () => {
    const field = createTwinBoundaryField(new PlaneGeometry(0.2, 0.2, 2, 2));
    const material = createTwinBoundaryMaterial(TWIN_SKIN_MATERIAL, field);
    // Only the three shader fields consumed by the documented callback;
    // the real WebGL compile is exercised by the browser comparison.
    const shader = {
      uniforms: {},
      vertexShader: ShaderLib["standard"]!.vertexShader,
      fragmentShader: ShaderLib["standard"]!.fragmentShader,
    } as Parameters<typeof material.onBeforeCompile>[0];
    material.onBeforeCompile(shader, {} as WebGLRenderer);
    expect(shader.vertexShader).not.toContain("_twin_mask");
    expect(shader.fragmentShader).toContain("texture2D(twinBoundaryTexture, vTwinBoundaryUv).r");
    expect(shader.fragmentShader).toContain("totalEmissiveRadiance *= twinSurfaceMask;");
    expect(shader.fragmentShader).toContain(
      "mix(twinBoundaryNeutralRoughness, roughnessFactor, twinSurfaceMask)",
    );
    expect(shader.uniforms["twinBoundaryTexture"]?.value).toBe(field.texture);
    material.dispose();
  });
});
