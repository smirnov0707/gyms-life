/** Isolated generic-authoring pose. CLI: REPO CLEAN_GLB OUTPUT_DIR SOURCE_OBJ_DIR SOURCE_SELECTION_JSON */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { reclassifyThighs } from "./reclassify-thighs.mjs";
const [repoArg, sourceArg, outArg, sourceDir, selectionPath] = process.argv.slice(2);
if (!repoArg || !sourceArg || !outArg || !sourceDir || !selectionPath)
  throw new Error("Expected REPO CLEAN_GLB OUTPUT_DIR SOURCE_OBJ_DIR SOURCE_SELECTION_JSON");
const repo = resolve(repoArg),
  source = resolve(sourceArg),
  out = resolve(outArg),
  sha = (b) => createHash("sha256").update(b).digest("hex");
if (out === join(repo, "public") || out.startsWith(join(repo, "public") + "/"))
  throw new Error("No public output");
if (source === join(out, "twin-anatomy-pose-candidate.glb"))
  throw new Error("The source asset must never be overwritten");
mkdirSync(out, { recursive: true });
const bytes = readFileSync(source),
  sourceSha = sha(bytes),
  expected = "50c847e66c5cc37bced5104a3644128d726dcec8d7f76e07127f04cf91bc4adc";
if (sourceSha !== expected) throw new Error("Expected the exact reviewed cleanup candidate");
const require = createRequire(join(repo, "package.json"));
const { NodeIO } = require("@gltf-transform/core"),
  { ALL_EXTENSIONS } = require("@gltf-transform/extensions");
const { Vector3, Raycaster } = require("three");
const { GLTFLoader } = await import(
  pathToFileURL(require.resolve("three/examples/jsm/loaders/GLTFLoader.js"))
);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS),
  doc = await io.read(source);
const original = [],
  triangles = [],
  primitives = [],
  byPoint = new Map(),
  canonical = [];
for (const node of doc.getRoot().listNodes())
  if (node.getMatrix().some((n, i) => Math.abs(n - ([0, 5, 10, 15].includes(i) ? 1 : 0)) > 1e-10))
    throw new Error("Candidate must have identity node transforms");
for (const mesh of doc.getRoot().listMeshes())
  for (const primitive of mesh.listPrimitives()) {
    const position = primitive.getAttribute("POSITION"),
      normal = primitive.getAttribute("NORMAL"),
      indices = primitive.getIndices(),
      uv = primitive.getAttribute("TEXCOORD_0"),
      local = [],
      name = primitive.getMaterial().getName();
    canonical.push(name);
    for (let i = 0; i < position.getCount(); i++) {
      const p = position.getElement(i, []),
        key = p.join(",");
      if (!byPoint.has(key)) {
        byPoint.set(key, original.length / 3);
        original.push(...p);
      }
      local.push(byPoint.get(key));
    }
    const offset = triangles.length;
    for (const i of indices.getArray()) triangles.push(local[i]);
    primitives.push({
      primitive,
      position,
      normal,
      indices,
      uv,
      local,
      name,
      offset,
      indicesHash: sha(Buffer.from(indices.getArray().buffer)),
      uvHash: uv ? sha(Buffer.from(uv.getArray().buffer)) : null,
      normalBefore: normal.getArray().slice(),
    });
  }
const centreX = 0.0007680885,
  hipX = 0.088,
  kneeX = 0.0793,
  ankleX = 0.07335,
  hipY = 0.882,
  kneeY = 0.445,
  ankleY = 0.095;
const hipAngle = (8 * Math.PI) / 180,
  lowerAngle = (2 * Math.PI) / 180;
const rotate = (p, angle) => [
  p[0] * Math.cos(angle) - p[1] * Math.sin(angle),
  p[0] * Math.sin(angle) + p[1] * Math.cos(angle),
  p[2],
];
const add = (a, b) => a.map((n, i) => n + b[i]),
  sub = (a, b) => a.map((n, i) => n - b[i]);
const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, w) => a.map((n, i) => n * (1 - w) + b[i] * w);
const rigs = [-1, 1].map((side) => {
  const hip = [centreX + side * hipX, hipY, -0.03],
    knee = [centreX + side * kneeX, kneeY, -0.03],
    ankle = [centreX + side * ankleX, ankleY, -0.055];
  const thigh = rotate(sub(knee, hip), side * hipAngle),
    shin = rotate(sub(ankle, knee), side * lowerAngle);
  const lowering = hip[1] + thigh[1] + shin[1] - ankle[1],
    posedHip = add(hip, [0, -lowering, 0]),
    posedKnee = add(posedHip, thigh),
    posedAnkle = add(posedKnee, shin);
  return { side, hip, knee, ankle, posedHip, posedKnee, posedAnkle, lowering };
});
function pose(p) {
  const x = p[0] - centreX,
    y = p[1],
    lateral = 1 - smooth(0.175, 0.195, Math.abs(x)),
    pelvisBlend = 1 - smooth(0.9, 1.025, y);
  if (y >= 1.025 || lateral === 0) return p.slice();
  const rig = rigs[x < 0 ? 0 : 1];
  const upper = add(rig.posedHip, rotate(sub(p, rig.hip), rig.side * hipAngle));
  const lower = add(rig.posedKnee, rotate(sub(p, rig.knee), rig.side * lowerAngle));
  const foot = add(p, sub(rig.posedAnkle, rig.ankle));
  const kneeBlend = 1 - smooth(kneeY - 0.065, kneeY + 0.065, y),
    footBlend = 1 - smooth(ankleY - 0.03, ankleY + 0.055, y);
  const leg = lerp(lerp(upper, lower, kneeBlend), foot, footBlend);
  const body = [p[0], p[1] - rig.lowering * pelvisBlend, p[2]];
  // The midline remains continuous; each leg rotates from its own hip.
  const legBlend = (1 - smooth(0.81, 0.985, y)) * smooth(0.005, 0.035, Math.abs(x));
  const rotated = lerp(body, leg, legBlend);
  const bridgeWeight =
    (1 - smooth(0.035, 0.075, Math.abs(x))) * smooth(0.6, 0.69, y) * (1 - smooth(0.91, 1.025, y));
  const bridge = [rotated[0], p[1] - rig.lowering * pelvisBlend, p[2]];
  return lerp(p, lerp(rotated, bridge, bridgeWeight), lateral);
}
const posed = new Float32Array(original.length),
  changed = new Uint8Array(original.length / 3);
for (let i = 0; i < original.length; i += 3) {
  const p = pose(original.slice(i, i + 3));
  posed.set(p, i);
  changed[i / 3] = p.some((n, k) => Math.abs(n - original[i + k]) > 1e-9) ? 1 : 0;
}
const cross = (p, a, b, c) => {
  const u = [0, 1, 2].map((k) => p[b * 3 + k] - p[a * 3 + k]),
    v = [0, 1, 2].map((k) => p[c * 3 + k] - p[a * 3 + k]);
  return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
};
const proposed = posed.slice(),
  degree = new Uint16Array(changed.length);
for (const p of triangles) degree[p]++;
const constraintHistory = [];
for (let pass = 0; pass < 24; pass++) {
  let corrected = 0;
  for (let at = 0; at < triangles.length; at += 3) {
    const ids = triangles.slice(at, at + 3),
      oldN = cross(original, ...ids),
      oldArea = Math.hypot(...oldN);
    const n = oldN.map((v) => v / oldArea),
      newN = cross(posed, ...ids),
      dot = n.reduce((sum, v, k) => sum + v * newN[k], 0),
      target = oldArea * 0.1;
    if (dot >= target * (1 - 1e-5)) continue;
    const [a, b, c] = ids.map((p) => Array.from(posed.subarray(p * 3, p * 3 + 3)));
    const crossV = (u, v) => [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    ];
    const gradients = [crossV(sub(b, c), n), crossV(sub(c, a), n), crossV(sub(a, b), n)];
    const weights = ids.map((p) => (changed[p] ? 1 / degree[p] : 0)),
      denominator = gradients.reduce(
        (sum, g, i) => sum + weights[i] * g.reduce((a, b) => a + b * b, 0),
        0,
      );
    if (!denominator) continue;
    const factor = (target - dot) / denominator;
    for (let i = 0; i < 3; i++)
      for (let k = 0; k < 3; k++) posed[ids[i] * 3 + k] += gradients[i][k] * factor * weights[i];
    corrected++;
  }
  constraintHistory.push(corrected);
  if (!corrected) break;
}
let maxConstraintCorrection = 0;
for (let p = 0; p < changed.length; p++)
  maxConstraintCorrection = Math.max(
    maxConstraintCorrection,
    Math.hypot(...[0, 1, 2].map((k) => posed[p * 3 + k] - proposed[p * 3 + k])),
  );
const normals = new Float64Array(posed.length),
  normalChanged = new Uint8Array(changed.length),
  ratios = [],
  cosines = [];
const inversionEvidence = [];
let inverted = 0,
  degenerate = 0,
  maxDisplacement = 0,
  headMoved = 0,
  handsMoved = 0;
for (let i = 0; i < triangles.length; i += 3) {
  const ids = triangles.slice(i, i + 3),
    before = cross(original, ...ids),
    after = cross(posed, ...ids),
    a = Math.hypot(...before),
    b = Math.hypot(...after);
  const cos = before.reduce((sum, n, k) => sum + n * after[k], 0) / (a * b);
  if (cos <= 0) {
    inverted++;
    inversionEvidence.push({
      triangle: i / 3,
      ids,
      beforePositions: ids.map((p) => original.slice(p * 3, p * 3 + 3)),
      afterPositions: ids.map((p) => Array.from(posed.subarray(p * 3, p * 3 + 3))),
      cos,
      area2Before: a,
      area2After: b,
    });
  }
  if (b < 2e-12) degenerate++;
  if (ids.some((p) => changed[p])) {
    ratios.push(b / a);
    cosines.push(cos);
    for (const p of ids) normalChanged[p] = 1;
  }
  for (const p of ids) for (let k = 0; k < 3; k++) normals[p * 3 + k] += after[k];
}
for (let p = 0; p < changed.length; p++) {
  const length = Math.hypot(normals[p * 3], normals[p * 3 + 1], normals[p * 3 + 2]);
  for (let k = 0; k < 3; k++) normals[p * 3 + k] /= length || 1;
  const d = Math.hypot(...[0, 1, 2].map((k) => posed[p * 3 + k] - original[p * 3 + k]));
  maxDisplacement = Math.max(maxDisplacement, d);
  if (original[p * 3 + 1] > 1.425 && d > 0) headMoved++;
  if (original[p * 3 + 1] < 0.88 && Math.abs(original[p * 3] - centreX) > 0.195 && d > 0)
    handsMoved++;
}
if (inverted)
  writeFileSync(join(out, "inversions.json"), JSON.stringify(inversionEvidence, null, 2) + "\n");
if (inverted || degenerate || headMoved || handsMoved)
  throw new Error(JSON.stringify({ inverted, degenerate, headMoved, handsMoved }));
for (const item of primitives) {
  const positions = new Float32Array(item.position.getCount() * 3),
    n = item.normal;
  for (let i = 0; i < item.local.length; i++) {
    const p = item.local[i];
    positions.set(posed.subarray(p * 3, p * 3 + 3), i * 3);
    if (normalChanged[p]) n.setElement(i, Array.from(normals.subarray(p * 3, p * 3 + 3)));
  }
  item.position.setArray(positions);
}
const mapping =
  sourceDir && selectionPath
    ? reclassifyThighs({
        sourceDir,
        selectionPath,
        original,
        posed,
        triangles,
        primitives,
        normals,
      })
    : null;
if (mapping)
  writeFileSync(join(out, "classification-evidence.json"), JSON.stringify(mapping, null, 2) + "\n");
const candidatePath = join(out, "twin-anatomy-pose-candidate.glb");
doc.getRoot().setExtras({
  ...doc.getRoot().getExtras(),
  candidateOnly: true,
  visualGatePassed: false,
  sourceCandidateSha256: sourceSha,
  poseOnly: !mapping,
  sourceBasedThighClassification: Boolean(mapping),
  poseDescription:
    "Generic symmetric 8 degree hip abduction, 6 degree knee counterrotation, planted feet, continuous pelvis blend. Not a personal measurement.",
});
await io.write(candidatePath, doc);
const candidateBytes = readFileSync(candidatePath),
  candidateSha = sha(candidateBytes);
const loaded = await io.read(candidatePath),
  posedLookup = new Map();
for (let p = 0; p < posed.length; p += 3)
  posedLookup.set(Array.from(posed.subarray(p, p + 3)).join(","), p / 3);
const exportedIndices = [];
let maxNormalUnitError = 0;
for (const mesh of loaded.getRoot().listMeshes())
  for (const primitive of mesh.listPrimitives()) {
    const p = primitive.getAttribute("POSITION"),
      n = primitive.getAttribute("NORMAL"),
      ids = primitive.getIndices().getArray(),
      local = [];
    for (let at = 0; at < p.getCount(); at++) {
      const global = posedLookup.get(p.getElement(at, []).join(","));
      if (global === undefined) throw new Error("Export changed posed coordinates");
      local.push(global);
      maxNormalUnitError = Math.max(
        maxNormalUnitError,
        Math.abs(Math.hypot(...n.getElement(at, [])) - 1),
      );
    }
    for (const id of ids) exportedIndices.push(local[id]);
  }
const triangleHash = (indices) => {
  const keys = [];
  for (let at = 0; at < indices.length; at += 3) {
    const t = indices.slice(at, at + 3),
      first = t.indexOf(Math.min(...t));
    keys.push([t[first], t[(first + 1) % 3], t[(first + 2) % 3]].join(","));
  }
  return sha(keys.sort().join("\n"));
};
const sourceTriangleHash = triangleHash(triangles),
  exportTriangleHash = triangleHash(exportedIndices);
const fileTopology = topology(posed, exportedIndices),
  sourceTopology = topology(original, triangles);
const picking = await rayAudit(candidateBytes);
const median = (a) => a.sort((a, b) => a - b)[Math.floor(a.length / 2)];
const sliceInfo = (positions) => {
  const feet = [[], []],
    ankles = [[], []];
  for (let p = 0; p < positions.length; p += 3) {
    const x = positions[p],
      y = positions[p + 1],
      side = x < centreX ? 0 : 1;
    if (y < 0.065 && Math.abs(x - centreX) < 0.25) feet[side].push(y);
    if (y >= 0.105 && y <= 0.125 && Math.abs(x - centreX) < 0.25) ankles[side].push(x);
  }
  const ankle = ankles.map(median);
  return {
    ankleSliceMetres: [0.105, 0.125],
    ankleMedianXMetres: ankle,
    ankleCentreProxySeparationMetres: ankle[1] - ankle[0],
    minimumFootYMetres: feet.map((a) => Math.min(...a)),
  };
};
ratios.sort((a, b) => a - b);
cosines.sort((a, b) => a - b);
const stats = (a) => ({
  min: a[0],
  p01: a[Math.floor(a.length * 0.01)],
  median: a[Math.floor(a.length * 0.5)],
  p99: a[Math.floor(a.length * 0.99)],
  max: a.at(-1),
});
const regions = primitives.map((i) => ({
  name: i.name,
  triangles: i.indices.getCount() / 3,
  indicesUnchanged: sha(Buffer.from(i.indices.getArray().buffer)) === i.indicesHash,
  uvUnchanged: i.uv
    ? sha(Buffer.from(i.uv.getArray().buffer).subarray(0, i.local.length * 2 * 4)) === i.uvHash
    : true,
  hasFiberUv: i.uv !== null && i.uv !== undefined,
}));
const report = {
  candidateOnly: true,
  visualGatePassed: false,
  productionIntegration: false,
  source: {
    file: source,
    sha256: sourceSha,
    bytes: bytes.length,
    topology: sourceTopology,
    pose: sliceInfo(original),
  },
  candidate: {
    file: candidatePath,
    sha256: candidateSha,
    bytes: candidateBytes.length,
    topology: fileTopology,
    pose: sliceInfo(posed),
  },
  parameters: {
    hipAngleDegrees: 8,
    kneeRelativeCounterrotationDegrees: -6,
    shinWorldAngleDegrees: 2,
    footWorldAngleDegrees: 0,
    rigs,
    landmarks:
      "Symmetric authoring landmarks informed by BP3D femur/tibia bounds; not clinically validated joint centres.",
  },
  deformation: {
    changedVertices: changed.reduce((a, b) => a + b, 0),
    orientationConstraintIterations: constraintHistory,
    maxOrientationConstraintCorrectionMetres: maxConstraintCorrection,
    maxDisplacementMetres: maxDisplacement,
    invertedTriangles: inverted,
    maxNormalUnitError,
    orientedTrianglePoolUnchanged: sourceTriangleHash === exportTriangleHash,
    sourceTriangleHash,
    exportTriangleHash,
    degenerateTriangles: degenerate,
    headVerticesMoved: headMoved,
    handVerticesMoved: handsMoved,
    changedTriangleAreaRatio: stats(ratios),
    changedTriangleNormalCosine: stats(cosines),
  },
  classification: mapping
    ? {
        reclassifiedTriangles: mapping.reclassifiedTriangles,
        byRegion: mapping.byRegion,
        geometryUnchangedByClassification: true,
        evidenceFile: "classification-evidence.json",
      }
    : null,
  regions,
  picking,
  limits: [
    "Visual gate pending; no 1:1 similarity approval.",
    "No exhaustive self-intersection proof.",
    "Linear blending near joints may soften local muscle volume; GPU close-up review required.",
    "Generic presentation pose, not a personal body prediction.",
  ],
  gates: {
    topologyPreserved: JSON.stringify(fileTopology) === JSON.stringify(sourceTopology),
    orientedTrianglePoolAndExistingUvsPreserved:
      sourceTriangleHash === exportTriangleHash && regions.every((r) => r.uvUnchanged),
    classificationPreservesTriangleCount: mapping ? mapping.triangleCountPreserved : true,
    allCanonicalRegionsRayReachable: picking.every((p) => p.hit),
    headHandsUnchanged: headMoved === 0 && handsMoved === 0,
    groundedFeet: sliceInfo(posed).minimumFootYMetres.every((n) => Math.abs(n) < 1e-5),
    normalsUnitLength: maxNormalUnitError < 0.005,
    khronos: "pending",
    gpuMultiAngle: "pending",
  },
};
writeFileSync(join(out, "pose-audit.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
if (Object.entries(report.gates).some(([, value]) => value === false)) process.exitCode = 2;

function topology(positions, indices) {
  const faces = indices.length / 3,
    pointCount = positions.length / 3,
    edges = new Map(),
    links = Array.from({ length: faces }, () => []),
    vertexLinks = Array.from({ length: pointCount }, () => new Map());
  let degenerates = 0;
  for (let t = 0; t < faces; t++) {
    const tri = indices.slice(t * 3, t * 3 + 3);
    if (Math.hypot(...cross(positions, ...tri)) < 2e-12) degenerates++;
    for (let k = 0; k < 3; k++) {
      const a = tri[k],
        b = tri[(k + 1) % 3],
        c = tri[(k + 2) % 3],
        key = a < b ? `${a},${b}` : `${b},${a}`;
      if (edges.has(key)) {
        const e = edges.get(key);
        e.count++;
        links[t].push(e.face);
        links[e.face].push(t);
      } else edges.set(key, { count: 1, face: t });
      const l = vertexLinks[a];
      if (!l.has(b)) l.set(b, new Set());
      if (!l.has(c)) l.set(c, new Set());
      l.get(b).add(c);
      l.get(c).add(b);
    }
  }
  const visited = new Uint8Array(faces);
  let components = 0,
    nonManifoldVertices = 0;
  for (let t = 0; t < faces; t++)
    if (!visited[t]) {
      components++;
      const queue = [t];
      visited[t] = 1;
      for (let i = 0; i < queue.length; i++)
        for (const other of links[queue[i]])
          if (!visited[other]) {
            visited[other] = 1;
            queue.push(other);
          }
    }
  for (const l of vertexLinks) {
    if (!l.size) continue;
    const queue = [l.keys().next().value],
      seen = new Set(queue);
    for (let i = 0; i < queue.length; i++)
      for (const other of l.get(queue[i]))
        if (!seen.has(other)) {
          seen.add(other);
          queue.push(other);
        }
    if (seen.size !== l.size || [...l.values()].some((s) => s.size > 2)) nonManifoldVertices++;
  }
  return {
    vertices: pointCount,
    triangles: faces,
    edgeConnectedComponents: components,
    boundaryEdges: [...edges.values()].filter((e) => e.count === 1).length,
    nonManifoldEdges: [...edges.values()].filter((e) => e.count > 2).length,
    nonManifoldVertices,
    degenerateTriangles: degenerates,
    eulerCharacteristic: pointCount - edges.size + faces,
  };
}
async function rayAudit(bytes) {
  const array = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    gltf = await new Promise((ok, fail) => new GLTFLoader().parse(array, "", ok, fail));
  gltf.scene.updateMatrixWorld(true);
  const meshes = [];
  gltf.scene.traverse((o) => {
    if (o.isMesh) meshes.push(o);
  });
  const ray = new Raycaster(),
    result = [],
    point = new Vector3(),
    normal = new Vector3(),
    a = new Vector3(),
    b = new Vector3(),
    c = new Vector3();
  for (const mesh of meshes) {
    if (mesh.material.name === "twin-region:neutral") continue;
    const pos = mesh.geometry.getAttribute("position"),
      indices = mesh.geometry.getIndex(),
      samples = Math.min(120, indices.count / 3);
    let hit = false,
      proof = null;
    for (let s = 0; s < samples && !hit; s++) {
      const t = Math.floor((s * (indices.count / 3)) / samples) * 3;
      a.fromBufferAttribute(pos, indices.getX(t));
      b.fromBufferAttribute(pos, indices.getX(t + 1));
      c.fromBufferAttribute(pos, indices.getX(t + 2));
      point
        .copy(a)
        .add(b)
        .add(c)
        .multiplyScalar(1 / 3);
      normal.copy(b).sub(a).cross(c.clone().sub(a)).normalize();
      ray.set(point.clone().addScaledVector(normal, 2), normal.clone().negate());
      const intersection = ray.intersectObjects(meshes, false)[0];
      if (intersection?.object === mesh) {
        hit = true;
        proof = {
          origin: ray.ray.origin.toArray(),
          direction: ray.ray.direction.toArray(),
          distance: intersection.distance,
          materialName: intersection.object.material.name,
        };
      }
    }
    result.push({ region: mesh.material.name, hit, proof });
  }
  return result;
}
