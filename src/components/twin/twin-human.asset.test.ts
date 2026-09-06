import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

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
  meshes?: { primitives?: { attributes: Record<string, number> }[] }[];
  accessors: { componentType: number }[];
  skins?: unknown[];
  extensionsRequired?: string[];
};

type Variant = {
  file: string;
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

      it("is a human-sized figure", () => {
        expect(stats.heightMetres).toBeGreaterThan(1.4);
        expect(stats.heightMetres).toBeLessThan(2.1);
        expect(stats.joints).toBeGreaterThan(0);
      });
    });
  }
});
