import { readFile } from "node:fs/promises";
import { NodeIO } from "@gltf-transform/core";
import { describe, expect, it } from "vitest";
import { BufferGeometry, Float32BufferAttribute } from "three";
import { fitTwinChestTexture } from "./twin-skin-uv";

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

  it("places both painted chest landmarks on the pectoral surface without UV folds", async () => {
    const doc = await new NodeIO().readBinary(
      new Uint8Array(await readFile("public/models/twin-natural-skin-v1.glb")),
    );
    const landmarks: number[][] = [];
    let smallestAreaRatio = Infinity;
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const primitive of mesh.listPrimitives()) {
        if (primitive.getMaterial()!.getName() === "Eyes") continue;
        const sourceUv = primitive.getAttribute("TEXCOORD_0")!;
        const sourcePosition = primitive.getAttribute("POSITION")!;
        const geometry = new BufferGeometry();
        geometry.setAttribute("uv", new Float32BufferAttribute(sourceUv.getArray()!, 2));
        geometry.setAttribute(
          "position",
          new Float32BufferAttribute(sourcePosition.getArray()!, 3),
        );
        fitTwinChestTexture(geometry);
        const uv = geometry.getAttribute("uv");
        const firstFit = uv.array.slice();
        fitTwinChestTexture(geometry);
        expect(uv.array).toEqual(firstFit);
        expect(geometry.getAttribute("position").array).toEqual(sourcePosition.getArray());
        const ids = primitive.getIndices()!.getArray()!;
        for (let i = 0; i < ids.length; i += 3) {
          const face = [ids[i]!, ids[i + 1]!, ids[i + 2]!];
          const original = face.map((id) => sourceUv.getElement(id, []));
          const fitted = face.map((id) => [uv.getX(id), uv.getY(id)]);
          const area = (points: number[][]) =>
            (points[1]![0]! - points[0]![0]!) * (points[2]![1]! - points[0]![1]!) -
            (points[2]![0]! - points[0]![0]!) * (points[1]![1]! - points[0]![1]!);
          const oldArea = area(original),
            newArea = area(fitted);
          if (Math.abs(oldArea) > 1e-9)
            smallestAreaRatio = Math.min(smallestAreaRatio, newArea / oldArea);
          if (Math.abs(newArea) < 1e-10) continue;
          // Centres in the unchanged native atlas. Locate where each texel is
          // actually painted on the surface, rather than testing a recipe constant.
          for (const u of [0.325, 0.43625]) {
            const point = [u, 0.3025];
            const a = area([point, fitted[1]!, fitted[2]!]) / newArea;
            const b = area([fitted[0]!, point, fitted[2]!]) / newArea;
            const weights = [a, b, 1 - a - b];
            if (weights.some((w) => w < -1e-6)) continue;
            landmarks.push(
              [0, 1, 2].map((axis) =>
                face.reduce(
                  (sum, id, j) => sum + sourcePosition.getElement(id, [])[axis]! * weights[j]!,
                  0,
                ),
              ),
            );
          }
        }
        geometry.dispose();
      }
    }
    expect(smallestAreaRatio).toBeGreaterThan(0.2);
    expect(landmarks).toHaveLength(2);
    for (const point of landmarks) {
      expect(point[1]).toBeGreaterThan(1.37);
      expect(point[1]).toBeLessThan(1.39);
      expect(Math.abs(point[0]!)).toBeGreaterThan(0.075);
      expect(Math.abs(point[0]!)).toBeLessThan(0.1);
    }
    expect(Math.abs(landmarks[0]![0]! + landmarks[1]![0]!)).toBeLessThan(0.004);
    expect(Math.abs(landmarks[0]![1]! - landmarks[1]![1]!)).toBeLessThan(0.002);
  });
});
