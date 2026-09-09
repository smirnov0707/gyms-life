/** Refine the exact native GLB into a separate, bounded artistic sculpt candidate. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, realpath } from "node:fs/promises";
import { resolve, join } from "node:path";
import { Document, NodeIO } from "@gltf-transform/core";
import { Matrix3, Matrix4, Vector3 } from "three";
import { sculptAt, protection, SCULPT_LOBES, SCULPT_MAX_DISPLACEMENT_M } from "./sculpt-fields.mjs";
import { auditNativeGlb } from "./audit-native-glb.mjs";

const PINNED_SOURCE = "5e965ec985c6eca556bf9059a707c259bcf3c7f7f0802f2388e4051fb4d03158";
const [inputArg, outputArg] = process.argv.slice(2);
assert(inputArg && outputArg, "Usage: node sculpt-native-muscle.mjs INPUT.glb OUTPUT_DIRECTORY");
const input = await realpath(inputArg),
  output = resolve(outputArg);
await mkdir(output, { recursive: true });
assert(
  !(await realpath(output)).split(/[\\/]/).includes("public"),
  "Review output only; never public/",
);
const destination = join(output, "twin-anatomy-sculpt-candidate.glb");
assert(resolve(input) !== destination, "Never overwrite the input");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const bytes = await readFile(input);
assert.equal(
  hash(bytes),
  PINNED_SOURCE,
  "Source geometry/pose must match the reviewed native baseline",
);
const doc = await new NodeIO().readBinary(bytes);
assert.equal(doc.getRoot().listAnimations().length, 0);
const positions = [],
  sourceNormals = [],
  faces = [],
  byPosition = new Map();
const scene = doc.getRoot().getDefaultScene();
assert(scene);
scene.traverse((node) => {
  assert(!node.getSkin());
  const transform = new Matrix4().fromArray(node.getWorldMatrix());
  for (const prim of node.getMesh()?.listPrimitives() ?? []) {
    assert.equal(prim.getMode(), 4);
    assert.equal(prim.listTargets().length, 0);
    const region = prim.getMaterial().getName().replace("twin-region:", "");
    const source = prim.getAttribute("POSITION");
    assert.equal(source.getComponentType(), 5126);
    const values = source.getArray(),
      normalValues = prim.getAttribute("NORMAL").getArray(),
      remap = [];
    const normalMatrix = new Matrix3().getNormalMatrix(transform);
    for (let i = 0; i < source.getCount(); i++) {
      const point = new Vector3()
        .fromArray(values, i * 3)
        .applyMatrix4(transform)
        .toArray();
      const key = point.join(",");
      if (!byPosition.has(key)) {
        byPosition.set(key, positions.length);
        positions.push(point);
        sourceNormals.push(
          new Vector3()
            .fromArray(normalValues, i * 3)
            .applyNormalMatrix(normalMatrix)
            .toArray(),
        );
      }
      remap.push(byPosition.get(key));
    }
    const ids = prim.getIndices().getArray();
    for (let i = 0; i < ids.length; i += 3)
      faces.push({ ids: [remap[ids[i]], remap[ids[i + 1]], remap[ids[i + 2]]], region });
  }
});
assert.equal(positions.length, 13290);
assert.equal(faces.length, 26576);
const edgeKey = (a, b) => (a < b ? `${a}:${b}` : `${b}:${a}`);
// Refine muscle surfaces while preserving a conforming neutral boundary.
// Hands/head stay at native density instead of needlessly quadrupling the whole file.
let workingFaces = faces;
for (let level = 0; level < 1; level++) {
  const midpoint = new Map();
  for (const face of workingFaces) {
    const centre = [0, 1, 2].map((k) => face.ids.reduce((sum, i) => sum + positions[i][k], 0) / 3);
    if (face.region === "neutral" && sculptAt(centre, "neutral").lift < 0.0002) continue;
    const [a, b, c] = face.ids;
    for (const [u, v] of [
      [a, b],
      [b, c],
      [c, a],
    ]) {
      const key = edgeKey(u, v);
      if (!midpoint.has(key)) {
        midpoint.set(key, positions.length);
        positions.push([0, 1, 2].map((k) => (positions[u][k] + positions[v][k]) / 2));
        const n = sourceNormals[u].map((value, k) => value + sourceNormals[v][k]),
          len = Math.hypot(...n);
        sourceNormals.push(n.map((v) => v / len));
      }
    }
  }
  const next = [];
  for (const {
    ids: [a, b, c],
    region,
  } of workingFaces) {
    const ab = midpoint.get(edgeKey(a, b)),
      bc = midpoint.get(edgeKey(b, c)),
      ca = midpoint.get(edgeKey(c, a));
    const add = (...tris) => tris.forEach((ids) => next.push({ ids, region }));
    const n = [ab, bc, ca].filter((i) => i !== undefined).length;
    if (n === 0) add([a, b, c]);
    else if (n === 3) add([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
    else if (n === 1) {
      if (ab !== undefined) add([a, ab, c], [ab, b, c]);
      else if (bc !== undefined) add([b, bc, a], [bc, c, a]);
      else add([c, ca, b], [ca, a, b]);
    } else {
      if (ab === undefined) add([c, ca, bc], [a, b, ca], [b, bc, ca]);
      else if (bc === undefined) add([a, ab, ca], [b, c, ab], [c, ca, ab]);
      else add([b, bc, ab], [c, a, bc], [a, ab, bc]);
    }
  }
  workingFaces = next;
}
const refined = workingFaces;
function cross(p, ids) {
  const [a, b, c] = ids.map((i) => p[i]);
  const u = b.map((x, k) => x - a[k]),
    v = c.map((x, k) => x - a[k]);
  return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
}
const baseNormals = sourceNormals;
const displacement = positions.map((p) => sculptAt(p, "neutral").lift);
const sculpted = positions.map((p, i) =>
  p.map((v, k) => Math.fround(v + baseNormals[i][k] * displacement[i])),
);
// Differentiate the bounded scalar relief against the smooth native normals.
// Recomputing area normals on linearly subdivided triangles creates visible
// alternating facets. Untouched vertices retain the native shading exactly.
const normals = positions.map((p, i) => {
  const n = baseNormals[i],
    epsilon = 0.0001;
  const gradient = [0, 1, 2].map((k) => {
    const a = [...p],
      b = [...p];
    a[k] += epsilon;
    b[k] -= epsilon;
    return (sculptAt(a, "neutral").lift - sculptAt(b, "neutral").lift) / (2 * epsilon);
  });
  const radial = gradient.reduce((sum, v, k) => sum + v * n[k], 0);
  const out = n.map((v, k) => v - gradient[k] + radial * v),
    length = Math.hypot(...out);
  return out.map((v) => v / length);
});
let minNormalDot = 1,
  minAreaRatio = Infinity,
  maxAreaRatio = 0,
  protectedCount = 0;
for (let i = 0; i < positions.length; i++)
  if (protection(positions[i]) === 0) {
    protectedCount++;
    assert(sculpted[i].every((v, k) => v === Math.fround(positions[i][k])));
  }
for (const face of refined) {
  const a = cross(positions, face.ids),
    b = cross(sculpted, face.ids),
    la = Math.hypot(...a),
    lb = Math.hypot(...b);
  assert(la > 1e-12 && lb > 1e-12, "Degenerate triangle");
  const dot = a.reduce((sum, v, k) => sum + v * b[k], 0) / la / lb;
  minNormalDot = Math.min(minNormalDot, dot);
  minAreaRatio = Math.min(minAreaRatio, lb / la);
  maxAreaRatio = Math.max(maxAreaRatio, lb / la);
}
assert(minNormalDot > 0.5, "Sculpt turns a triangle too far");
assert(minAreaRatio > 0.2 && maxAreaRatio < 5, "Sculpt stretches a triangle too far");
const edges = new Map(),
  members = positions.map(() => new Set()),
  graph = positions.map(() => new Set());
for (const { ids, region } of refined)
  for (let k = 0; k < 3; k++) {
    const a = ids[k],
      b = ids[(k + 1) % 3],
      key = edgeKey(a, b);
    const edge = edges.get(key) ?? { count: 0, winding: 0 };
    edge.count++;
    edge.winding += a < b ? 1 : -1;
    edges.set(key, edge);
    members[a].add(region);
    graph[a].add(b);
    graph[b].add(a);
  }
assert(
  [...edges.values()].every((e) => e.count === 2 && e.winding === 0),
  "Non-manifold edge or winding error",
);
assert.equal(positions.length - edges.size + refined.length, 2, "Topology changed");
const visited = new Set([0]),
  todo = [0];
while (todo.length) {
  for (const v of graph[todo.pop()])
    if (!visited.has(v)) {
      visited.add(v);
      todo.push(v);
    }
}
assert.equal(visited.size, positions.length, "Disconnected geometry");
// One geometric seam, one normal. Tint vanishes on every shared material boundary.
const seamWeight = members.map((m, i) => {
  if (m.size > 1) return 0;
  const distances = [...graph[i]]
    .filter((j) => members[j].size > 1)
    .map((j) => Math.hypot(...positions[i].map((v, k) => v - positions[j][k])));
  return distances.length ? Math.min(1, Math.min(...distances) / 0.006) : 1;
});
const result = new Document(),
  buffer = result.createBuffer(),
  resultScene = result.createScene();
result.getRoot().setDefaultScene(resultScene);
Object.assign(result.getRoot().getAsset(), {
  generator: "GYMS.LIFE bounded presentation sculpt",
  copyright: "CC0 MakeHuman graphical assets; GYMS.LIFE presentation sculpt",
});
result.getRoot().setExtras({
  candidateOnly: true,
  visualGatePassed: false,
  productionIntegration: false,
  sourceSha256: PINNED_SOURCE,
  regionMeaning: "Generic art-directed presentation lobes, not medical segmentation",
});
const accessor = (name, array, type) =>
  result.createAccessor(name).setType(type).setArray(array).setBuffer(buffer);
const regions = [...new Set(refined.map((f) => f.region))];
const counts = {};
for (const region of regions) {
  const selected = refined.filter((f) => f.region === region),
    ids = [...new Set(selected.flatMap((f) => f.ids))],
    lookup = new Map(ids.map((id, i) => [id, i]));
  const mask = ids.map((id) =>
    region === "neutral" ? 0 : protection(positions[id]) * seamWeight[id],
  );
  const uv = ids.flatMap((id) => [positions[id][1], sculptAt(positions[id], region).fiberPhase]);
  const primitive = result
    .createPrimitive()
    .setAttribute(
      "POSITION",
      accessor(region + ":position", Float32Array.from(ids.flatMap((i) => sculpted[i])), "VEC3"),
    )
    .setAttribute(
      "_TWIN_SCULPT_POSITION",
      accessor(
        region + ":sculpt-position",
        Float32Array.from(ids.flatMap((i) => positions[i])),
        "VEC3",
      ),
    )
    .setAttribute(
      "NORMAL",
      accessor(region + ":normal", Float32Array.from(ids.flatMap((i) => normals[i])), "VEC3"),
    )
    .setAttribute("TEXCOORD_0", accessor(region + ":uv", Float32Array.from(uv), "VEC2"))
    .setAttribute("_TWIN_MASK", accessor(region + ":mask", Float32Array.from(mask), "SCALAR"))
    .setIndices(
      accessor(
        region + ":indices",
        Uint32Array.from(selected.flatMap((f) => f.ids.map((i) => lookup.get(i)))),
        "SCALAR",
      ),
    );
  const name = "twin-region:" + region;
  primitive.setMaterial(
    result
      .createMaterial(name)
      .setBaseColorFactor([0.055, 0.085, 0.12, 1])
      .setRoughnessFactor(0.6)
      .setMetallicFactor(0.12),
  );
  const extras = {
    twinFiberUV: region !== "neutral",
    twinRegionMask: true,
    twinSculptedSurface: true,
    candidateOnly: true,
    ...(region !== "neutral"
      ? {
          twinSculptContours: SCULPT_LOBES.filter((g) => g.region === region).map(
            ({ centre, radii, angle }) => ({ centre, radii, angle }),
          ),
        }
      : {}),
  };
  resultScene.addChild(
    result
      .createNode(name)
      .setMesh(result.createMesh(name).addPrimitive(primitive).setExtras(extras))
      .setExtras(extras),
  );
  counts[region] = {
    triangles: selected.length,
    vertices: ids.length,
    tintedVertices: ids.filter(
      (id) => region !== "neutral" && sculptAt(positions[id], region).mask * seamWeight[id] > 0.5,
    ).length,
  };
}
const exported = Buffer.from(await new NodeIO().writeBinary(result));
const intersections = await auditNativeGlb(exported);
const audit = {
  assetSha256: hash(exported),
  sourceSha256: PINNED_SOURCE,
  bytes: exported.length,
  vertices: positions.length,
  triangles: refined.length,
  connectedComponents: 1,
  boundaryEdges: 0,
  nonManifoldEdges: 0,
  inconsistentWinding: 0,
  eulerCharacteristic: 2,
  maximumDisplacementMetres: displacement.reduce((a, b) => Math.max(a, b), 0),
  allowedDisplacementMetres: SCULPT_MAX_DISPLACEMENT_M,
  protectedVertices: protectedCount,
  minimumTriangleNormalDot: minNormalDot,
  minimumAreaRatio: minAreaRatio,
  maximumAreaRatio: maxAreaRatio,
  regions: counts,
  presentationGuides: SCULPT_LOBES,
  visualGatePassed: false,
  productionIntegration: false,
  limitations: [
    "Generic authored presentation, not a measured body or medical segmentation",
    "Fibers are art-directed procedural coordinates, not measured muscle fiber directions",
    "The exact GLB intersection audit excludes shared-vertex triangle pairs",
    "Visual comparison and integration checks required before promotion",
  ],
};
await writeFile(join(output, "sculpt.audit.json"), JSON.stringify(audit, null, 2) + "\n");
await writeFile(
  join(output, "sculpt.intersections.json"),
  JSON.stringify(intersections, null, 2) + "\n",
);
assert(
  intersections.passed,
  "Exact exported geometry intersection audit failed; candidate not written",
);
await writeFile(destination, exported);
console.log(
  JSON.stringify(
    { destination, ...audit, presentationGuides: SCULPT_LOBES.length, intersections },
    null,
    2,
  ),
);
