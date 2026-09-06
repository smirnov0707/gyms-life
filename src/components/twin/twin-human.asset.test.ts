import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Box3, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { TWIN_BODY_REGIONS } from "./twin-scene.model";

/**
 * The shipped human is a binary nobody reads in review, and its manifest is
 * the only place the CC-BY credit and the measured budget live. If the two
 * drift apart, the app either ships an asset it does not describe or credits
 * an author whose model it no longer uses. Both are checked here against the
 * files themselves rather than against the manifest's own claims.
 */

const MODELS = path.resolve("public/models");

/** Only the parts of the glTF document these checks look at. */
type Gltf = {
  scene?: number;
  scenes: { nodes: number[] }[];
  nodes: { children?: number[] }[];
  meshes?: { primitives?: { attributes: Record<string, number>; indices?: number }[] }[];
  materials?: { name?: string }[];
  accessors: { componentType: number; count: number }[];
  skins?: unknown[];
  extensionsRequired?: string[];
};

type Variant = {
  file: string;
  regions: Record<string, number>;
  bytes: number;
  gzipBytes: number;
  triangles: number;
  heightMetres: number;
  joints: number;
  textures: number;
};

const manifest = JSON.parse(
  readFileSync(path.join(MODELS, "twin-human.manifest.json"), "utf8"),
) as {
  version: string;
  source: Record<string, string>;
  variants: Record<string, Variant>;
};

/** Minimal GLB reader: enough to check what the file actually contains. */
function readGlb(file: string) {
  const buffer = readFileSync(file);
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const total = view.getUint32(8, true);
  let offset = 12;
  let json: Record<string, never> | null = null;
  while (offset < total) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    if (type === 0x4e4f534a) {
      json = JSON.parse(new TextDecoder().decode(buffer.subarray(offset + 8, offset + 8 + length)));
    }
    offset += 8 + length + ((4 - (length % 4)) % 4);
  }
  if (!json) throw new Error(`${file} has no JSON chunk`);
  return { buffer, gltf: json as unknown as Gltf };
}

describe("twin human asset", () => {
  it("credits the author the licence requires", () => {
    // CC BY is not satisfied by a file sitting in the repository; the credit
    // has to travel with it.
    expect(manifest.source["licence"]).toBe("CC BY 4.0");
    expect(manifest.source["author"]).toBeTruthy();
    expect(manifest.source["authorProfile"]).toMatch(/^https:\/\//);
    expect(manifest.source["url"]).toMatch(/^https:\/\//);
  });

  for (const [variant, stats] of Object.entries(manifest.variants)) {
    describe(variant, () => {
      const file = path.join("public", stats.file);
      const { buffer, gltf } = readGlb(file);

      it("is the file the manifest describes", () => {
        expect(buffer.byteLength).toBe(stats.bytes);
      });

      it("carries the UVs a textured skin will need", () => {
        // The asset was chosen for its unwrap. A prune that drops unused
        // attributes silently removes it, and nothing else would notice.
        const attributes = new Set<string>();
        for (const mesh of gltf.meshes ?? []) {
          for (const primitive of mesh.primitives ?? []) {
            Object.keys(primitive.attributes ?? {}).forEach((a) => attributes.add(a));
          }
        }
        expect(attributes.has("TEXCOORD_0")).toBe(true);
      });

      it("keeps one skeleton and no unreachable nodes", () => {
        expect((gltf.skins ?? []).length).toBe(1);
        const reachable = new Set<number>();
        const visit = (index: number) => {
          if (reachable.has(index)) return;
          reachable.add(index);
          const node = gltf.nodes[index];
          if (!node) throw new Error(`node ${index} is referenced but missing`);
          for (const child of node.children ?? []) visit(child);
        };
        const scene = gltf.scenes[gltf.scene ?? 0];
        if (!scene) throw new Error("the file declares no default scene");
        for (const root of scene.nodes) visit(root);
        expect(gltf.nodes.length - reachable.size).toBe(0);
      });

      it("stores positions a loader can read without an extension", () => {
        // Quantized positions need KHR_mesh_quantization declared. An earlier
        // build wrote int16 positions without it, which decodes at the wrong
        // scale in a compliant loader.
        expect(gltf.extensionsRequired ?? []).toEqual([]);
        for (const mesh of gltf.meshes ?? []) {
          for (const primitive of mesh.primitives ?? []) {
            const index = primitive.attributes["POSITION"];
            if (index === undefined) throw new Error("a primitive has no POSITION attribute");
            const accessor = gltf.accessors[index];
            if (!accessor) throw new Error(`accessor ${index} is referenced but missing`);
            expect(accessor.componentType).toBe(5126); // float32
          }
        }
      });

      it("stays inside the mobile budget", () => {
        expect(stats.bytes).toBeLessThan(8 * 1024 * 1024);
        expect(stats.triangles).toBeLessThan(40_000);
      });

      it("covers every canonical region with selectable surface", () => {
        // A region with no triangles is a body part the app offers and cannot
        // show; one with a handful is a target no finger can hit.
        for (const region of TWIN_BODY_REGIONS) {
          expect(stats.regions[region] ?? 0).toBeGreaterThan(50);
        }
      });

      it("assigns every body triangle to exactly one region", () => {
        // The split shares vertices and partitions indices. A triangle in no
        // group is a hole; one in two groups is a double hit on a click.
        const body = (gltf.meshes ?? []).reduce((a, b) =>
          primitiveCount(a, gltf) > primitiveCount(b, gltf) ? a : b,
        );
        const fromPrimitives = (body.primitives ?? []).reduce((total, primitive) => {
          const indices = primitive.indices;
          if (indices === undefined) return total;
          const accessor = gltf.accessors[indices];
          return total + (accessor ? accessor.count / 3 : 0);
        }, 0);
        const fromManifest = Object.values(stats.regions).reduce((a, b) => a + b, 0);
        expect(fromPrimitives).toBe(fromManifest);
      });

      it("carries the region on a material name, where glTF can keep it", () => {
        // Primitives have no name in the glTF spec, so the region travels on
        // the material. An earlier build set primitive names and exported a
        // file with none of them in it.
        const names = new Set((gltf.materials ?? []).map((m) => m.name));
        for (const region of TWIN_BODY_REGIONS) {
          expect(names.has(`twin-region:${region}`)).toBe(true);
        }
      });

      it("is a human-sized figure", () => {
        expect(stats.heightMetres).toBeGreaterThan(1.4);
        expect(stats.heightMetres).toBeLessThan(2.1);
        expect(stats.joints).toBeGreaterThan(0);
      });

      it("stands with its arms down, not held out to be measured", async () => {
        // The source figures pose with the arms out at about 40 degrees below
        // horizontal so a rigger can reach the armpit. Nobody stands like that,
        // and arms flat against the body would cover its sides from a click.
        const drop = await armDropDegrees(buffer);
        expect(drop).toBeGreaterThan(60);
        expect(drop).toBeLessThan(85);
      });

      it("stands on the ground, centred on the origin the camera orbits", async () => {
        // Measured through the skin, because that is the only measurement a
        // renderer agrees with. The node hierarchy once reported this figure
        // centred while three.js drew it 0.64 m to the side, where no click
        // could reach it and the camera framed empty space.
        const { min, max } = await restPoseBounds(buffer);
        expect(Math.abs(min.y)).toBeLessThan(0.005);
        expect(Math.abs((min.x + max.x) / 2)).toBeLessThan(0.005);
        expect(Math.abs((min.z + max.z) / 2)).toBeLessThan(0.005);
        expect(max.y - min.y).toBeCloseTo(stats.heightMetres, 2);
      });
    });
  }
});

/** Loads the shipped file the way the browser does, with its pose applied. */
async function loadScene(file: Buffer) {
  const bytes = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  const gltf = await new Promise<{ scene: import("three").Object3D }>((done, failed) => {
    new GLTFLoader().parse(bytes as ArrayBuffer, "", done, failed);
  });
  gltf.scene.updateMatrixWorld(true);
  return gltf.scene;
}

/**
 * How far the left arm hangs below horizontal, shoulder to hand, on the posed
 * skeleton. three sanitises bone names on load, so the rig's dots are gone.
 */
async function armDropDegrees(file: Buffer) {
  const scene = await loadScene(file);
  const bone = (pattern: RegExp) => {
    let found: import("three").Object3D | null = null;
    scene.traverse((object) => {
      if (!found && (object as import("three").Bone).isBone && pattern.test(object.name)) {
        found = object;
      }
    });
    if (!found) throw new Error(`no bone matching ${String(pattern)}`);
    return found as import("three").Object3D;
  };
  const from = bone(/^DEF-upper_armL/).getWorldPosition(new Vector3());
  const to = bone(/^DEF-handL/).getWorldPosition(new Vector3());
  return (Math.atan2(from.y - to.y, Math.hypot(to.x - from.x, to.z - from.z)) * 180) / Math.PI;
}

/**
 * The figure's bounding box with every vertex pushed through its joint
 * matrices in the rest pose — what the browser draws, rather than what the
 * node transforms claim.
 */
async function restPoseBounds(file: Buffer) {
  const scene = await loadScene(file);

  const box = new Box3();
  const point = new Vector3();
  scene.traverse((object) => {
    const skinned = object as import("three").SkinnedMesh;
    if (!skinned.isSkinnedMesh) return;
    const position = skinned.geometry.getAttribute("position");
    for (let v = 0; v < position.count; v++) {
      point.fromBufferAttribute(position, v);
      skinned.applyBoneTransform(v, point);
      box.expandByPoint(skinned.localToWorld(point));
    }
  });
  if (box.isEmpty()) throw new Error("no skinned geometry to measure");
  return box;
}

/** Triangles in a mesh, used only to find the body among the eyes. */
function primitiveCount(mesh: { primitives?: { indices?: number }[] }, gltf: Gltf): number {
  return (mesh.primitives ?? []).reduce((total, primitive) => {
    const index = primitive.indices;
    if (index === undefined) return total;
    return total + (gltf.accessors[index]?.count ?? 0);
  }, 0);
}
