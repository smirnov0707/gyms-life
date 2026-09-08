/** Audit the exact static native GLB, never an unbound authoring NPZ sidecar. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { Box3, Matrix4, Ray, Triangle, Vector3 } from "three";

const EPS = 1e-8;
const overlaps = (a, b) =>
  ["x", "y", "z"].every(
    (axis) => a.min[axis] <= b.max[axis] + EPS && b.min[axis] <= a.max[axis] + EPS,
  );

export function auditTriangleMesh(vertices, indices) {
  assert(vertices.length > 0 && indices.length > 0, "Empty geometry");
  assert(
    vertices.every((p) => [p.x, p.y, p.z].every(Number.isFinite)),
    "Non-finite coordinates",
  );
  let duplicates = 0;
  let degenerate = 0;
  const seen = new Set();
  const triangles = indices.map((ids, id) => {
    assert(
      ids.length === 3 && ids.every((i) => Number.isInteger(i) && i >= 0 && i < vertices.length),
      "Invalid triangle indices",
    );
    const key = [...ids].sort((a, b) => a - b).join(",");
    if (seen.has(key)) duplicates++;
    seen.add(key);
    const triangle = new Triangle(...ids.map((i) => vertices[i]));
    if (triangle.getArea() <= 1e-16) degenerate++;
    const box = new Box3().setFromPoints([triangle.a, triangle.b, triangle.c]);
    return {
      id,
      ids,
      triangle,
      box,
      centre: box.getCenter(new Vector3()),
      normal: triangle.getNormal(new Vector3()),
    };
  });
  function build(items) {
    const box = new Box3();
    const centres = new Box3();
    for (const item of items) {
      box.union(item.box);
      centres.expandByPoint(item.centre);
    }
    if (items.length <= 12) return { box, items };
    const size = centres.getSize(new Vector3());
    const axis = size.x >= size.y && size.x >= size.z ? "x" : size.y >= size.z ? "y" : "z";
    const sorted = [...items].sort((a, b) => a.centre[axis] - b.centre[axis]);
    const mid = Math.floor(sorted.length / 2);
    return { box, children: [build(sorted.slice(0, mid)), build(sorted.slice(mid))] };
  }
  const ray = new Ray();
  const direction = new Vector3();
  const intersection = new Vector3();
  function segmentHit(start, end, triangle) {
    direction.subVectors(end, start);
    const length = direction.length();
    if (length <= EPS) return false;
    ray.set(start, direction.divideScalar(length));
    return (
      ray.intersectTriangle(triangle.a, triangle.b, triangle.c, false, intersection) !== null &&
      start.distanceToSquared(intersection) <= (length + EPS) ** 2
    );
  }
  let broadPhasePairs = 0,
    incidentPairs = 0,
    hits = 0,
    coplanar = 0;
  const examples = [],
    coplanarExamples = [];
  const delta = new Vector3();
  function inspect(a, b) {
    if (!overlaps(a.box, b.box)) return;
    if (a.ids.some((id) => b.ids.includes(id))) {
      incidentPairs++;
      return;
    }
    broadPhasePairs++;
    const parallel = Math.abs(a.normal.dot(b.normal)) > 1 - 1e-12;
    const samePlane = Math.abs(delta.subVectors(b.triangle.a, a.triangle.a).dot(a.normal)) < EPS;
    if (parallel && samePlane) {
      coplanar++;
      if (coplanarExamples.length < 100) coplanarExamples.push([a.id, b.id]);
      return; // Ambiguous overlap fails closed; never treated as a clean pass.
    }
    const av = [a.triangle.a, a.triangle.b, a.triangle.c];
    const bv = [b.triangle.a, b.triangle.b, b.triangle.c];
    if (
      [0, 1, 2].some(
        (i) =>
          segmentHit(av[i], av[(i + 1) % 3], b.triangle) ||
          segmentHit(bv[i], bv[(i + 1) % 3], a.triangle),
      )
    ) {
      hits++;
      if (examples.length < 100) examples.push([a.id, b.id]);
    }
  }
  function visit(a, b) {
    if (!overlaps(a.box, b.box)) return;
    if (a === b) {
      if (a.children) {
        const [left, right] = a.children;
        visit(left, left);
        visit(right, right);
        visit(left, right);
      } else
        for (let i = 0; i < a.items.length; i++) {
          for (let j = i + 1; j < a.items.length; j++) inspect(a.items[i], a.items[j]);
        }
    } else if (a.children) for (const child of a.children) visit(child, b);
    else if (b.children) for (const child of b.children) visit(a, child);
    else for (const u of a.items) for (const v of b.items) inspect(u, v);
  }
  const tree = build(triangles);
  visit(tree, tree);
  return {
    completed: true,
    vertices: vertices.length,
    triangles: triangles.length,
    nonincidentBroadPhasePairs: broadPhasePairs,
    excludedIncidentPairs: incidentPairs,
    intersectingPairs: hits,
    coplanarPairsRequiringReview: coplanar,
    duplicateTriangles: duplicates,
    degenerateTriangles: degenerate,
    intersectionExamples: examples,
    coplanarExamples,
    passed: hits === 0 && coplanar === 0 && duplicates === 0 && degenerate === 0,
    toleranceMetres: EPS,
    method:
      "Exact GLB world positions; exact-position seam welding; AABB BVH; six segment/triangle tests; coplanar ambiguity fails closed",
    scope:
      "Nonincident triangles only. Shared-vertex pairs are excluded, not proven intersection-free. No anatomical, clinical, or visual approval.",
  };
}

export async function auditNativeGlb(bytes) {
  assert(
    bytes.length >= 12 &&
      bytes.toString("ascii", 0, 4) === "glTF" &&
      bytes.readUInt32LE(4) === 2 &&
      bytes.readUInt32LE(8) === bytes.length,
    "Invalid GLB header",
  );
  const doc = await new NodeIO().readBinary(new Uint8Array(bytes));
  assert(
    doc.getRoot().listAnimations().length === 0,
    "Animated geometry is outside this static audit",
  );
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  assert(scene, "Missing GLB scene");
  const vertices = [],
    indices = [],
    byPosition = new Map();
  const point = new Vector3();
  function collect(node) {
    assert(!node.getSkin(), "Skinned geometry is outside this static audit");
    const matrix = new Matrix4().fromArray(node.getWorldMatrix());
    for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
      assert(
        primitive.getMode() === 4 && !primitive.listTargets().length,
        "Only static triangle primitives supported",
      );
      const positions = primitive.getAttribute("POSITION");
      assert(
        positions?.getType() === "VEC3" && positions.getComponentType() === 5126,
        "Native audit requires Float32 positions",
      );
      const remap = [];
      const values = positions.getArray();
      for (let i = 0; i < positions.getCount(); i++) {
        point.fromArray(values, i * 3).applyMatrix4(matrix);
        const key = [point.x, point.y, point.z].join(",");
        if (!byPosition.has(key)) {
          byPosition.set(key, vertices.length);
          vertices.push(point.clone());
        }
        remap.push(byPosition.get(key));
      }
      const source = primitive.getIndices()?.getArray() ?? remap.map((_, i) => i);
      assert(source.length % 3 === 0, "Incomplete triangle");
      for (let i = 0; i < source.length; i += 3) {
        indices.push([remap[source[i]], remap[source[i + 1]], remap[source[i + 2]]]);
      }
    }
    for (const child of node.listChildren()) collect(child);
  }
  for (const node of scene.listChildren()) collect(node);
  return {
    assetSha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
    ...auditTriangleMesh(vertices, indices),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [input, output] = process.argv.slice(2);
  assert(
    input && output && resolve(input) !== resolve(output),
    "Usage: node audit-native-glb.mjs input.glb output.audit.json (different paths required)",
  );
  let report;
  try {
    report = await auditNativeGlb(await readFile(input));
  } catch (error) {
    report = { completed: false, passed: false, error: String(error) };
  }
  await mkdir(dirname(resolve(output)), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 2;
}
