/** Reproducible visual refinement. Never modifies the registered source assets. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { NodeIO } from "@gltf-transform/core";
import { Matrix3, Matrix4, Vector3 } from "three";
import { auditNativeGlb } from "./audit-native-glb.mjs";

const inputs = [
  [
    "tests/twin-browser/assets/twin-anatomy-muscular-candidate.glb",
    "5e965ec985c6eca556bf9059a707c259bcf3c7f7f0802f2388e4051fb4d03158",
  ],
  [
    "public/models/twin-selected-v1.glb",
    "e94fdf6acf09bf82285d4797a5abef26e2928516ecb5e3a97aad78c32491ca31",
  ],
];
const io = new NodeIO();
const docs = [];
for (const [path, sha] of inputs) {
  const bytes = await readFile(path);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), sha);
  docs.push(await io.readBinary(bytes));
}
const [native, output] = docs;
const normals = new Map();
const key = (p) => p.map((v) => Math.fround(v).toFixed(7)).join(",");
// Recover smooth source normals for original vertices and the single subdivision.
// This avoids facet normals from recomputing a linearly subdivided surface.
native
  .getRoot()
  .getDefaultScene()
  .traverse((node) => {
    const matrix = new Matrix4().fromArray(node.getWorldMatrix());
    const normalMatrix = new Matrix3().getNormalMatrix(matrix);
    for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
      const position = primitive.getAttribute("POSITION");
      const normal = primitive.getAttribute("NORMAL");
      const points = [],
        directions = [];
      for (let i = 0; i < position.getCount(); i++) {
        const p = new Vector3()
          .fromArray(position.getArray(), i * 3)
          .applyMatrix4(matrix)
          .toArray();
        const n = new Vector3().fromArray(normal.getArray(), i * 3).applyNormalMatrix(normalMatrix);
        points.push(p);
        directions.push(n);
        normals.set(key(p), n);
      }
      const indices = primitive.getIndices().getArray();
      for (let i = 0; i < indices.length; i += 3) {
        for (const [a, b] of [
          [0, 1],
          [1, 2],
          [2, 0],
        ]) {
          const u = indices[i + a],
            v = indices[i + b];
          const p = points[u].map((value, k) => (value + points[v][k]) / 2);
          normals.set(key(p), directions[u].clone().add(directions[v]).normalize());
        }
      }
    }
  });
const smooth = (a, b, v) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
// Smooth, symmetric and monotonic in z: no local lobes or raised muscle plates.
const chestOffset = ([x, y, z]) =>
  0.026 *
  (1 - smooth(0.14, 0.205, Math.abs(x))) *
  smooth(1.28, 1.35, y) *
  (1 - smooth(1.47, 1.54, y)) *
  smooth(0.035, 0.12, z);
let count = 0,
  maxDisplacement = 0;
for (const mesh of output.getRoot().listMeshes()) {
  for (const primitive of mesh.listPrimitives()) {
    const source = primitive.getAttribute("_TWIN_SCULPT_POSITION");
    assert(source, "Exact original coordinates are required");
    const positions = primitive.getAttribute("POSITION").getArray();
    const destinationNormals = primitive.getAttribute("NORMAL").getArray();
    for (let i = 0; i < source.getCount(); i++) {
      const p = Array.from(source.getArray().slice(i * 3, i * 3 + 3));
      const n = normals.get(key(p));
      assert(n, `Missing source normal at ${p}`);
      const offset = chestOffset(p);
      const gradient = p.map((_, k) => {
        const a = [...p],
          b = [...p];
        a[k] += 0.00001;
        b[k] -= 0.00001;
        return (chestOffset(a) - chestOffset(b)) / 0.00002;
      });
      assert(1 - gradient[2] > 0.5, "Deformation must remain orientation preserving");
      const nz = n.z / (1 - gradient[2]);
      const transformed = new Vector3(
        n.x + gradient[0] * nz,
        n.y + gradient[1] * nz,
        nz,
      ).normalize();
      for (let k = 0; k < 3; k++) positions[i * 3 + k] = p[k] - (k === 2 ? offset : 0);
      transformed.toArray(destinationNormals, i * 3);
      maxDisplacement = Math.max(maxDisplacement, offset);
      count++;
    }
  }
}
const bytes = Buffer.from(await io.writeBinary(output));
const audit = await auditNativeGlb(bytes);
assert(audit.passed, JSON.stringify(audit));
await writeFile("public/models/twin-natural-v1.glb", bytes);
await writeFile(
  "tests/twin-browser/assets/twin-natural-v1.audit.json",
  JSON.stringify(
    {
      ...audit,
      sources: inputs,
      restoredVertices: count,
      maxChestReductionMetres: maxDisplacement,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    sha256: audit.assetSha256,
    bytes: bytes.length,
    passed: audit.passed,
    count,
    maxDisplacement,
  }),
);
