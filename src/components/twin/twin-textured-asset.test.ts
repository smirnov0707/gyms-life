import { readFile } from "node:fs/promises";
import { NodeIO } from "@gltf-transform/core";
import { describe, expect, it } from "vitest";

// Read data only: GPU texture decoding is covered by the browser suite.
describe("registered natural skin geometry", () => {
  it("preserves every oriented triangle while splitting native UV seams", async () => {
    const io = new NodeIO();
    const before = await io.readBinary(
      new Uint8Array(await readFile("public/models/twin-natural-v1.glb")),
    );
    const after = await io.readBinary(
      new Uint8Array(await readFile("public/models/twin-natural-skin-v1.glb")),
    );
    const triangles = (doc: typeof before) =>
      doc
        .getRoot()
        .listMeshes()
        .flatMap((mesh) =>
          mesh
            .listPrimitives()
            .filter((primitive) => primitive.getMaterial()!.getName() !== "Eyes")
            .flatMap((primitive) => {
              const position = primitive.getAttribute("POSITION")!;
              const indices = primitive.getIndices()!.getArray()!;
              const rows = [];
              for (let i = 0; i < indices.length; i += 3) {
                const points = [0, 1, 2].map((j) =>
                  position.getElement(indices[i + j]!, []).join(","),
                );
                rows.push(primitive.getMaterial()!.getName() + ":" + points.join(";"));
              }
              return rows;
            }),
        )
        .sort();
    expect(triangles(after)).toEqual(triangles(before));
    expect(after.getRoot().listTextures()).toHaveLength(2);
    const texture = after.getRoot().listTextures()[0]!;
    expect(texture.getMimeType()).toBe("image/jpeg");
    expect(texture.getSize()).toEqual([2048, 2048]);
    for (const mesh of after.getRoot().listMeshes()) {
      for (const primitive of mesh.listPrimitives()) {
        expect(primitive.getMaterial()!.getBaseColorTexture()).toBe(
          primitive.getMaterial()!.getName() === "Eyes"
            ? after.getRoot().listTextures()[1]
            : texture,
        );
        const uv = primitive.getAttribute("TEXCOORD_0")!;
        expect(uv.getCount()).toBe(primitive.getAttribute("POSITION")!.getCount());
        for (const value of uv.getArray()!) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});
