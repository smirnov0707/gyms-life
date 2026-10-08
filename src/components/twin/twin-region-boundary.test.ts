import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Mesh, PlaneGeometry } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createTwinBoundaryMask, TWIN_BACK_FEATHER_METRES } from "./twin-region-boundary";
import { loadTwinHuman } from "./twin-human.loader";

afterEach(() => vi.unstubAllGlobals());
const asBuffer = (file: string) => new Uint8Array(readFileSync(file)).buffer;

function vertices(geometry: BufferGeometry) {
  return Object.fromEntries(
    Object.entries(geometry.attributes).map(([name, attr]) => [name, Array.from(attr.array)]),
  );
}

describe("bounded visual region-edge feather", () => {
  it("leaves geometry and all existing attributes untouched", () => {
    const geometry = new PlaneGeometry(0.2, 0.2, 8, 8);
    const before = vertices(geometry);
    const indices = Array.from(geometry.index!.array);
    const mask = createTwinBoundaryMask(geometry);
    expect(mask.count).toBe(geometry.getAttribute("position").count);
    expect(mask.itemSize).toBe(1);
    expect(vertices(geometry)).toEqual(before);
    expect(Array.from(geometry.index!.array)).toEqual(indices);
    expect(geometry.getAttribute("_twin_mask")).toBeUndefined();
  });

  it("neutralizes the existing border and retains a fully highlighted interior", () => {
    const geometry = new PlaneGeometry(0.2, 0.2, 20, 20);
    const mask = createTwinBoundaryMask(geometry);
    const position = geometry.getAttribute("position");
    let transition = 0;
    for (let i = 0; i < position.count; i++) {
      const edge = Math.max(Math.abs(position.getX(i)), Math.abs(position.getY(i)));
      const weight = mask.getX(i);
      expect(weight).toBeGreaterThanOrEqual(0);
      expect(weight).toBeLessThanOrEqual(1);
      if (edge > 0.099) expect(weight).toBe(0);
      if (edge < 0.07) expect(weight).toBe(1);
      if (weight > 0 && weight < 1) transition++;
    }
    expect(transition).toBeGreaterThan(0);
  });

  it("treats coincident UV/normal seams as interior, not holes", () => {
    const indexed = new PlaneGeometry(0.2, 0.2, 10, 10);
    const plain = indexed.toNonIndexed();
    const a = createTwinBoundaryMask(indexed);
    const b = createTwinBoundaryMask(plain);
    for (let i = 0; i < plain.getAttribute("position").count; i++)
      expect(b.getX(i)).toBe(a.getX(indexed.index!.getX(i)));
  });

  it("keeps closed meshes without open borders unchanged", () => {
    const mask = createTwinBoundaryMask(new BoxGeometry(0.2, 0.2, 0.2));
    expect([...mask.array].every((value) => value === 1)).toBe(true);
  });

  it.each([0, -0.1, NaN, Infinity, 0.2])("rejects an invalid width %s", (width) => {
    expect(() => createTwinBoundaryMask(new PlaneGeometry(), width)).toThrow("WIDTH_INVALID");
  });

  it("rejects malformed triangle indices instead of inventing a mask", () => {
    const geometry = new PlaneGeometry(0.2, 0.2, 2, 2);
    geometry.setIndex([0, 1, 100]);
    expect(() => createTwinBoundaryMask(geometry)).toThrow("INDEX_INVALID");
  });

  it("rejects nonfinite coordinates and degenerate triangles", () => {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 0, 0, 0, 1, 0, 0], 3));
    expect(() => createTwinBoundaryMask(geometry)).toThrow("DEGENERATE_TRIANGLE");
    geometry.getAttribute("position").setX(0, NaN);
    expect(() => createTwinBoundaryMask(geometry)).toThrow("POSITION_NONFINITE");
  });

  it("rejects a non-manifold edge", () => {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, -1, 0, 0.5, 0.5, 1], 3),
    );
    geometry.setIndex([0, 1, 2, 1, 0, 3, 0, 1, 4]);
    expect(() => createTwinBoundaryMask(geometry)).toThrow("NONMANIFOLD");
  });

  it("feathers the actual registered back with no geometry or selection change", async () => {
    const gltf = await new GLTFLoader().parseAsync(asBuffer("public/models/twin-body-v2.glb"), "");
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
    const geometry = back[0]!.geometry;
    const before = vertices(geometry);
    const indices = Array.from(geometry.index!.array);
    const start = performance.now();
    const mask = createTwinBoundaryMask(geometry);
    console.log("Back boundary CPU", {
      milliseconds: performance.now() - start,
      width: TWIN_BACK_FEATHER_METRES,
      vertices: mask.count,
      neutral: [...mask.array].filter((x) => x === 0).length,
      partial: [...mask.array].filter((x) => x > 0 && x < 1).length,
      full: [...mask.array].filter((x) => x === 1).length,
    });
    expect(mask.count).toBe(1461);
    expect([...mask.array].filter((x) => x === 1).length).toBeGreaterThan(500);
    expect([...mask.array].filter((x) => x === 0).length).toBeGreaterThan(100);
    expect([...mask.array].every((x) => Number.isFinite(x) && x >= 0 && x <= 1)).toBe(true);
    expect(vertices(geometry)).toEqual(before);
    expect(Array.from(geometry.index!.array)).toEqual(indices);
  });

  it("applies the mask only to the verified realistic back, not other regions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(asBuffer("public/models/twin-body-v2.glb"))),
    );
    const model = await loadTwinHuman("/models/twin-body-v2.glb", undefined, "realistic");
    for (const mesh of model.meshes) {
      const mask = mesh.geometry.getAttribute("_twin_mask");
      if (model.regionOf.get(mesh) === "back") expect(mask?.count).toBe(1461);
      else expect(mask).toBeUndefined();
    }
    expect(model.regionMeshes.size).toBe(8);
    model.dispose();
    model.dispose();
  });

  it("preserves the analysis mesh's authored mask exactly", async () => {
    const bytes = asBuffer("public/models/twin-selected-v1.glb");
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
});
