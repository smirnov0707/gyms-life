import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { Document, NodeIO } from "@gltf-transform/core";
import { Vector3 } from "three";
import { auditNativeGlb, auditTriangleMesh } from "./audit-native-glb.mjs";
const vertices = (rows) => rows.map((p) => new Vector3(...p));
const base = [
  [0, 0, 0],
  [1, 0, 0],
  [0, 1, 0],
];
const indices = [
  [0, 1, 2],
  [3, 4, 5],
];

test("separated triangles and an empty broad phase pass", () => {
  const result = auditTriangleMesh(vertices([...base, [0, 0, 2], [1, 0, 2], [0, 1, 2]]), indices);
  assert.equal(result.passed, true);
  assert.equal(result.nonincidentBroadPhasePairs, 0);
});
test("a real crossing fails", () => {
  const result = auditTriangleMesh(
    vertices([...base, [0.2, 0.2, -1], [0.2, 0.2, 1], [0.8, 0.2, 0]]),
    indices,
  );
  assert.equal(result.intersectingPairs, 1);
  assert.equal(result.passed, false);
});
test("coplanar ambiguity fails closed", () => {
  const result = auditTriangleMesh(
    vertices([...base, [0.1, 0.1, 0], [0.8, 0.1, 0], [0.1, 0.8, 0]]),
    indices,
  );
  assert.equal(result.coplanarPairsRequiringReview, 1);
  assert.equal(result.passed, false);
});
test("shared-edge pairs are explicitly excluded, not claimed intersection-free", () => {
  const result = auditTriangleMesh(vertices([...base, [1, 1, 0]]), [
    [0, 1, 2],
    [1, 3, 2],
  ]);
  assert.equal(result.excludedIncidentPairs, 1);
  assert.equal(result.nonincidentBroadPhasePairs, 0);
});
test("duplicates, degeneracy and invalid input cannot pass", () => {
  assert.equal(
    auditTriangleMesh(vertices(base), [
      [0, 1, 2],
      [2, 1, 0],
    ]).passed,
    false,
  );
  assert.equal(auditTriangleMesh(vertices(base), [[0, 0, 1]]).passed, false);
  assert.throws(() => auditTriangleMesh([], []));
});
test("GLB bytes bind the hash and world transforms are applied before welding", async () => {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const positions = doc
    .createAccessor()
    .setType("VEC3")
    .setArray(new Float32Array(base.flat()))
    .setBuffer(buffer);
  const mesh = doc
    .createMesh()
    .addPrimitive(doc.createPrimitive().setAttribute("POSITION", positions));
  const scene = doc.createScene();
  doc.getRoot().setDefaultScene(scene);
  scene.addChild(doc.createNode().setMesh(mesh));
  const moved = doc.createNode().setMesh(mesh).setTranslation([0, 0, 2]);
  scene.addChild(moved);
  const bytes = Buffer.from(await new NodeIO().writeBinary(doc));
  const result = await auditNativeGlb(bytes);
  assert.equal(result.assetSha256, createHash("sha256").update(bytes).digest("hex"));
  assert.equal(result.vertices, 6);
  assert.equal(result.passed, true);
  moved.setTranslation([0, 0, 0]);
  const changed = await auditNativeGlb(Buffer.from(await new NodeIO().writeBinary(doc)));
  assert.notEqual(changed.assetSha256, result.assetSha256);
  assert.equal(changed.duplicateTriangles, 1);
  assert.equal(changed.passed, false);
});
test("malformed or truncated GLB is rejected", async () => {
  await assert.rejects(() => auditNativeGlb(Buffer.from("invalid")), /Invalid GLB/);
});
