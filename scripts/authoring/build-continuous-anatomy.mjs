/** Candidate only. CLI: node scripts/authoring/build-continuous-anatomy.mjs REPO OBJ_DIR ELEMENTS_TXT OUTPUT_DIR */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { exteriorSkin, closeExterior } from "./exterior.mjs";

const [repoArg, objArg, elementsArg, outputArg] = process.argv.slice(2);
if (!repoArg || !objArg || !elementsArg || !outputArg)
  throw new Error("Expected REPO OBJ_DIR ELEMENTS_TXT OUTPUT_DIR");
const repo = resolve(repoArg),
  objDir = resolve(objArg),
  elements = resolve(elementsArg);
const out = resolve(outputArg);
if (out === join(repo, "public") || out.startsWith(join(repo, "public") + "/"))
  throw new Error("Candidate output must not be inside public/");
mkdirSync(out, { recursive: true });
const require = createRequire(join(repo, "package.json"));
const { Document, NodeIO } = require("@gltf-transform/core");
const { quantize, prune } = require("@gltf-transform/functions");
const { ALL_EXTENSIONS, KHRMeshQuantization } = require("@gltf-transform/extensions");
const { regionForMuscle, MUSCLE_REGIONS } = await import(
  pathToFileURL(join(repo, "scripts/twin-muscle-regions.mjs"))
);
const { GLTFLoader } = await import(
  pathToFileURL(require.resolve("three/examples/jsm/loaders/GLTFLoader.js"))
);
const { Vector3 } = require("three");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fileHash = (path) => sha(readFileSync(path));
const canonical = ["neutral", ...MUSCLE_REGIONS];
const idOf = new Map(canonical.map((name, index) => [name, index]));
const files = new Set(
  readdirSync(objDir)
    .filter((name) => name.endsWith(".obj"))
    .map((name) => name.slice(0, -4)),
);
const names = new Map();
for (const line of readFileSync(elements, "utf8").split(/\r?\n/).slice(1)) {
  const [, name, file] = line.split("\t");
  if (!name || !files.has(file)) continue;
  if (!names.has(file)) names.set(file, new Set());
  names.get(file).add(name);
}
const skinFiles = [...names]
  .filter(([, entries]) => [...entries].some((name) => name.toLowerCase() === "skin"))
  .map(([file]) => file);
if (!skinFiles.length) throw new Error("Source has no registered skin");

// Only structures exposed at the external envelope; deep muscles should never
// colour through a more superficial structure or become inflated external plates.
const superficial =
  /pectoralis major|deltoid|latissimus dorsi|trapezius|infraspinatus|teres major|biceps brachii|triceps brachii|brachioradialis|anconeus|extensor carpi|flexor carpi|extensor digitorum$|muscle of anterior abdominal wall|external oblique|rectus abdominis|serratus anterior|gluteus maximus|gluteus medius|rectus femoris|vastus lateralis|vastus medialis|biceps femoris|semitendinosus|semimembranosus|gastrocnemius|sartorius|gracilis|adductor longus|tensor fasciae latae|tibialis anterior|peroneus longus|peroneus brevis/i;
const selection = [];
for (const [file, entries] of names) {
  const match = [...entries].find((name) => superficial.test(name) && regionForMuscle(name));
  if (match) selection.push({ file, region: regionForMuscle(match), anatomicalName: match });
}
function obj(file) {
  const positions = [],
    indices = [];
  for (const line of readFileSync(join(objDir, `${file}.obj`), "latin1").split("\n")) {
    if (line.startsWith("v ")) {
      const [, x, y, z] = line.trim().split(/\s+/).map(Number);
      positions.push(x, z, -y);
    } else if (line.startsWith("f ")) {
      const corners = line
        .trim()
        .split(/\s+/)
        .slice(1)
        .map((value) => Number(value.split("/")[0]) - 1);
      for (let at = 2; at < corners.length; at++)
        indices.push(corners[0], corners[at - 1], corners[at]);
    }
  }
  return { positions, indices };
}
const raw = { positions: [], indices: [] };
for (const file of skinFiles) {
  const part = obj(file),
    offset = raw.positions.length / 3;
  for (const value of part.positions) raw.positions.push(value);
  for (const value of part.indices) raw.indices.push(value + offset);
}
let low = Infinity,
  high = -Infinity,
  cx = 0,
  cz = 0;
for (let at = 0; at < raw.positions.length; at += 3) {
  low = Math.min(low, raw.positions[at + 1]);
  high = Math.max(high, raw.positions[at + 1]);
  cx += raw.positions[at];
  cz += raw.positions[at + 2];
}
cx /= raw.positions.length / 3;
cz /= raw.positions.length / 3;
const scale = 1.7 / (high - low);
const convert = (source) => {
  const result = new Float64Array(source.length);
  for (let at = 0; at < source.length; at += 3) {
    result[at] = (source[at] - cx) * scale;
    result[at + 1] = (source[at + 1] - low) * scale;
    result[at + 2] = (source[at + 2] - cz) * scale;
  }
  return result;
};
function clean(positions, indices, epsilon = 1e-7) {
  const unique = [],
    uniqueSource = [],
    map = new Map(),
    remap = new Uint32Array(positions.length / 3);
  for (let at = 0; at < positions.length; at += 3) {
    const key = [0, 1, 2].map((axis) => Math.round(positions[at + axis] / epsilon)).join(",");
    if (!map.has(key)) {
      map.set(key, unique.length / 3);
      unique.push(positions[at], positions[at + 1], positions[at + 2]);
      uniqueSource.push(at / 3);
    }
    remap[at / 3] = map.get(key);
  }
  const kept = [],
    faces = new Set();
  let degenerateRemoved = 0,
    duplicateRemoved = 0;
  for (let at = 0; at < indices.length; at += 3) {
    const tri = [remap[indices[at]], remap[indices[at + 1]], remap[indices[at + 2]]];
    if (new Set(tri).size < 3) {
      degenerateRemoved++;
      continue;
    }
    const [a, b, c] = tri.map((value) => value * 3);
    const u = [0, 1, 2].map((axis) => unique[b + axis] - unique[a + axis]);
    const v = [0, 1, 2].map((axis) => unique[c + axis] - unique[a + axis]);
    const area2 = Math.hypot(
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    );
    if (area2 < 2e-12) {
      degenerateRemoved++;
      continue;
    }
    const key = [...tri].sort((a, b) => a - b).join(",");
    if (faces.has(key)) {
      duplicateRemoved++;
      continue;
    }
    faces.add(key);
    kept.push(...tri);
  }
  const referenced = new Map(),
    compact = [],
    sourceVertexIndices = [];
  for (let at = 0; at < kept.length; at++) {
    const old = kept[at];
    if (!referenced.has(old)) {
      referenced.set(old, compact.length / 3);
      compact.push(unique[old * 3], unique[old * 3 + 1], unique[old * 3 + 2]);
      sourceVertexIndices.push(uniqueSource[old]);
    }
    kept[at] = referenced.get(old);
  }
  return {
    positions: new Float64Array(compact),
    indices: new Uint32Array(kept),
    sourceVertexIndices,
    degenerateRemoved,
    duplicateRemoved,
  };
}
function neighboursOf(count, indices) {
  const sets = Array.from({ length: count }, () => new Set());
  for (let at = 0; at < indices.length; at += 3) {
    const a = indices[at],
      b = indices[at + 1],
      c = indices[at + 2];
    sets[a].add(b).add(c);
    sets[b].add(a).add(c);
    sets[c].add(a).add(b);
  }
  return sets.map((set) => [...set]);
}
function normalsOf(positions, indices) {
  const normals = new Float32Array(positions.length);
  for (let at = 0; at < indices.length; at += 3) {
    const a = indices[at] * 3,
      b = indices[at + 1] * 3,
      c = indices[at + 2] * 3;
    const ux = positions[b] - positions[a],
      uy = positions[b + 1] - positions[a + 1],
      uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a],
      vy = positions[c + 1] - positions[a + 1],
      vz = positions[c + 2] - positions[a + 2];
    const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    for (const p of [a, b, c]) for (let axis = 0; axis < 3; axis++) normals[p + axis] += n[axis];
  }
  for (let at = 0; at < normals.length; at += 3) {
    const length = Math.hypot(normals[at], normals[at + 1], normals[at + 2]) || 1;
    for (let axis = 0; axis < 3; axis++) normals[at + axis] /= length;
  }
  return normals;
}

let skin = clean(convert(raw.positions), raw.indices);
const rawSkinAudit = topology(skin.positions, skin.indices);
const extracted = exteriorSkin(skin.positions, skin.indices);
const exteriorAudit = {
  ...extracted.audit,
  topology: topology(extracted.positions, extracted.indices),
};
console.log("Exterior extraction", JSON.stringify(exteriorAudit));
const closed = closeExterior(extracted.positions, extracted.indices);
exteriorAudit.closure = closed.audit;
skin = clean(closed.positions, closed.indices);
exteriorAudit.closedTopology = topology(skin.positions, skin.indices);
let halfWidth = 0;
for (let at = 0; at < skin.positions.length; at += 3)
  halfWidth = Math.max(halfWidth, Math.abs(skin.positions[at]));
const midline = (p) =>
  Math.abs(skin.positions[p * 3]) <= halfWidth * 0.12 && skin.positions[p * 3 + 2] > 0;
const ring = [];
for (let p = 0; p < skin.positions.length / 3; p++)
  if (
    midline(p) &&
    skin.positions[p * 3 + 1] >= 1.7 * 0.515 &&
    skin.positions[p * 3 + 1] <= 1.7 * 0.527
  )
    ring.push(p);
if (!ring.length) throw new Error("Cannot identify registered pubic closure anchor");
const anchor = [0, 1, 2].map(
  (axis) => ring.reduce((sum, p) => sum + skin.positions[p * 3 + axis], 0) / ring.length,
);
let collapsed = 0;
for (let p = 0; p < skin.positions.length / 3; p++)
  if (
    midline(p) &&
    skin.positions[p * 3 + 1] >= 1.7 * 0.445 &&
    skin.positions[p * 3 + 1] <= 1.7 * 0.515
  ) {
    for (let axis = 0; axis < 3; axis++) skin.positions[p * 3 + axis] = anchor[axis];
    collapsed++;
  }
skin = clean(skin.positions, skin.indices);
const adjacency = neighboursOf(skin.positions.length / 3, skin.indices);
const inGroin = (p) =>
  skin.positions[p * 3 + 1] >= 1.7 * 0.4 &&
  skin.positions[p * 3 + 1] <= 1.7 * 0.54 &&
  Math.abs(skin.positions[p * 3]) < halfWidth * 0.36 &&
  skin.positions[p * 3 + 2] > 0;
const movable = adjacency.map((around, p) => around.length && inGroin(p) && around.every(inGroin));
for (let pass = 0; pass < 90; pass++) {
  const next = skin.positions.slice();
  for (let p = 0; p < adjacency.length; p++)
    if (movable[p])
      for (let axis = 0; axis < 3; axis++) {
        const mean =
          adjacency[p].reduce((sum, other) => sum + skin.positions[other * 3 + axis], 0) /
          adjacency[p].length;
        next[p * 3 + axis] = skin.positions[p * 3 + axis] * 0.55 + mean * 0.45;
      }
  skin.positions = next;
}
const pca = (positions) => {
  const centre = [0, 0, 0],
    count = positions.length / 3;
  for (let at = 0; at < positions.length; at += 3)
    for (let axis = 0; axis < 3; axis++) centre[axis] += positions[at + axis] / count;
  const cov = Array(9).fill(0);
  for (let at = 0; at < positions.length; at += 3)
    for (let a = 0; a < 3; a++)
      for (let b = 0; b < 3; b++)
        cov[a * 3 + b] +=
          ((positions[at + a] - centre[a]) * (positions[at + b] - centre[b])) / count;
  let axis = [0.31, 0.71, 0.51];
  for (let iteration = 0; iteration < 30; iteration++) {
    const next = [0, 1, 2].map((row) =>
      axis.reduce((sum, value, col) => sum + cov[row * 3 + col] * value, 0),
    );
    const length = Math.hypot(...next) || 1;
    axis = next.map((value) => value / length);
  }
  return { centreMetres: centre, geometricPrincipalAxis: axis, fiberDirectionVerified: false };
};
// A median-split source point tree avoids scanning the whole atlas per vertex.
const sourcePoints = [];
for (const item of selection) {
  const part = obj(item.file),
    points = convert(part.positions);
  Object.assign(item, {
    sha256: fileHash(join(objDir, `${item.file}.obj`)),
    sourceTriangles: part.indices.length / 3,
    ...pca(points),
  });
  for (let at = 0; at < points.length; at += 3) {
    const x = points[at],
      y = points[at + 1],
      z = points[at + 2];
    sourcePoints.push(x, y, z, idOf.get(item.region));
  }
}
const pointCount = sourcePoints.length / 4;
const order = Array.from({ length: pointCount }, (_, i) => i),
  left = new Int32Array(pointCount).fill(-1),
  right = new Int32Array(pointCount).fill(-1),
  treePoint = new Uint32Array(pointCount);
const swap = (a, b) => {
  const t = order[a];
  order[a] = order[b];
  order[b] = t;
};
function medianSelect(lo, hi, wanted, axis) {
  while (lo < hi) {
    const pivot = sourcePoints[order[(lo + hi) >> 1] * 4 + axis];
    let a = lo,
      b = lo,
      c = hi;
    while (b <= c) {
      const value = sourcePoints[order[b] * 4 + axis];
      if (value < pivot) swap(a++, b++);
      else if (value > pivot) swap(b, c--);
      else b++;
    }
    if (wanted < a) hi = a - 1;
    else if (wanted > c) lo = c + 1;
    else return;
  }
}
function buildTree(lo, hi, depth = 0) {
  if (lo > hi) return -1;
  const mid = (lo + hi) >> 1;
  medianSelect(lo, hi, mid, depth % 3);
  treePoint[mid] = order[mid];
  left[mid] = buildTree(lo, mid - 1, depth + 1);
  right[mid] = buildTree(mid + 1, hi, depth + 1);
  return mid;
}
const treeRoot = buildTree(0, pointCount - 1);
const nearest = (x, y, z) => {
  let best = 0.06 ** 2,
    result = null;
  const query = [x, y, z];
  function visit(node, depth) {
    if (node < 0) return;
    const at = treePoint[node] * 4;
    const d =
      (x - sourcePoints[at]) ** 2 +
      (y - sourcePoints[at + 1]) ** 2 +
      (z - sourcePoints[at + 2]) ** 2;
    if (d < best) {
      best = d;
      result = {
        point: sourcePoints.slice(at, at + 3),
        region: sourcePoints[at + 3],
        distance: Math.sqrt(d),
      };
    }
    const delta = query[depth % 3] - sourcePoints[at + (depth % 3)];
    visit(delta < 0 ? left[node] : right[node], depth + 1);
    if (delta * delta < best) visit(delta < 0 ? right[node] : left[node], depth + 1);
  }
  visit(treeRoot, 0);
  return result;
};
const normals = normalsOf(skin.positions, skin.indices);
let labels = new Uint8Array(adjacency.length),
  offsets = new Float64Array(adjacency.length);
const protectedVertex = new Uint8Array(adjacency.length);
for (let p = 0; p < adjacency.length; p++) {
  const at = p * 3,
    x = skin.positions[at],
    y = skin.positions[at + 1],
    z = skin.positions[at + 2];
  const protectedPart =
    y > 1.7 * 0.84 ||
    y < 1.7 * 0.065 ||
    (y < 1.7 * 0.475 && Math.abs(x) > halfWidth * 0.55) ||
    inGroin(p);
  protectedVertex[p] = protectedPart ? 1 : 0;
  if (protectedPart) continue;
  const close = nearest(x, y, z);
  if (!close || close.distance > 0.045) continue;
  labels[p] = close.region;
  const inwardGap =
    (x - close.point[0]) * normals[at] +
    (y - close.point[1]) * normals[at + 1] +
    (z - close.point[2]) * normals[at + 2];
  offsets[p] = Math.max(0, Math.min(0.004, (inwardGap - 0.0015) * 0.4));
}
// Smooth labels and inset across the existing connected surface, without cuts.
for (let pass = 0; pass < 8; pass++) {
  const nextLabels = labels.slice(),
    nextOffsets = offsets.slice();
  for (let p = 0; p < adjacency.length; p++) {
    if (protectedVertex[p] || !adjacency[p].length) continue;
    const votes = new Uint16Array(canonical.length);
    votes[labels[p]] += 3;
    for (const other of adjacency[p]) votes[labels[other]]++;
    let winner = labels[p];
    for (let label = 0; label < votes.length; label++)
      if (votes[label] > votes[winner]) winner = label;
    nextLabels[p] = winner;
    const mean = adjacency[p].reduce((sum, other) => sum + offsets[other], 0) / adjacency[p].length;
    nextOffsets[p] = offsets[p] * 0.55 + mean * 0.45;
  }
  labels = nextLabels;
  offsets = nextOffsets;
}
for (let p = 0; p < adjacency.length; p++)
  for (let axis = 0; axis < 3; axis++)
    skin.positions[p * 3 + axis] -= normals[p * 3 + axis] * offsets[p];
// Two low-amplitude Taubin pairs remove scan-scale spikes without inflation.
for (const weight of [0.12, -0.125, 0.12, -0.125]) {
  const next = skin.positions.slice();
  for (let p = 0; p < adjacency.length; p++)
    if (!protectedVertex[p] && adjacency[p].length)
      for (let axis = 0; axis < 3; axis++) {
        const mean =
          adjacency[p].reduce((sum, other) => sum + skin.positions[other * 3 + axis], 0) /
          adjacency[p].length;
        next[p * 3 + axis] += weight * (mean - skin.positions[p * 3 + axis]);
      }
  skin.positions = next;
}
// Pubic relaxation may concentrate vertices. Weld those at 0.05 mm and close
// residual rings before export; preserve region labels through the remap.
const repaired = clean(skin.positions, skin.indices, 5e-5);
const remappedLabels = Uint8Array.from(repaired.sourceVertexIndices, (old) => labels[old]);
const authoredClosure = closeExterior(repaired.positions, repaired.indices);
labels = new Uint8Array(authoredClosure.positions.length / 3);
labels.set(remappedLabels);
skin = authoredClosure;
const finalNormals = normalsOf(skin.positions, skin.indices);
const regionIndices = canonical.map(() => []);
for (let at = 0; at < skin.indices.length; at += 3) {
  const tri = [skin.indices[at], skin.indices[at + 1], skin.indices[at + 2]],
    region = tri.map((p) => labels[p]);
  const label =
    region[0] === region[1] || region[0] === region[2]
      ? region[0]
      : region[1] === region[2]
        ? region[1]
        : region[0];
  regionIndices[label].push(...tri);
}
const document = new Document(),
  buffer = document.createBuffer();
const scene = document.createScene("twin-anatomy-continuous-candidate");
const counts = {};
for (let id = 0; id < canonical.length; id++) {
  counts[canonical[id]] = regionIndices[id].length / 3;
  if (!regionIndices[id].length) continue;
  const remap = new Map(),
    localPositions = [],
    localNormals = [],
    localIndices = [];
  for (const old of regionIndices[id]) {
    if (!remap.has(old)) {
      remap.set(old, localPositions.length / 3);
      for (let axis = 0; axis < 3; axis++) {
        localPositions.push(skin.positions[old * 3 + axis]);
        localNormals.push(finalNormals[old * 3 + axis]);
      }
    }
    localIndices.push(remap.get(old));
  }
  const position = document
    .createAccessor()
    .setType("VEC3")
    .setArray(new Float32Array(localPositions))
    .setBuffer(buffer);
  const normal = document
    .createAccessor()
    .setType("VEC3")
    .setArray(new Float32Array(localNormals))
    .setBuffer(buffer);
  const primitive = document
    .createPrimitive()
    .setAttribute("POSITION", position)
    .setAttribute("NORMAL", normal)
    .setIndices(
      document
        .createAccessor()
        .setType("SCALAR")
        .setArray(new Uint32Array(localIndices))
        .setBuffer(buffer),
    )
    .setMaterial(
      document
        .createMaterial(`twin-region:${canonical[id]}`)
        .setBaseColorFactor([0.025, 0.045, 0.06, 1])
        .setRoughnessFactor(0.6)
        .setMetallicFactor(0.1),
    );
  const mesh = document.createMesh(`twin-region:${canonical[id]}`).addPrimitive(primitive);
  const node = document.createNode(`twin-region:${canonical[id]}`).setMesh(mesh);
  scene.addChild(node);
  if (id !== 0) {
    const min = [Infinity, Infinity, Infinity],
      max = [-Infinity, -Infinity, -Infinity];
    let meanAbsX = 0;
    for (let at = 0; at < localPositions.length; at += 3) {
      meanAbsX += Math.abs(localPositions[at]) / (localPositions.length / 3);
      for (let axis = 0; axis < 3; axis++) {
        min[axis] = Math.min(min[axis], localPositions[at + axis]);
        max[axis] = Math.max(max[axis], localPositions[at + axis]);
      }
    }
    const width = Math.max(Math.abs(min[0]), Math.abs(max[0]), 0.001),
      height = Math.max(0.001, max[1] - min[1]);
    const uv = new Array((localPositions.length / 3) * 2).fill(0);
    for (let p = 0; p < localPositions.length / 3; p++) {
      const x = localPositions[p * 3],
        y = localPositions[p * 3 + 1],
        z = localPositions[p * 3 + 2];
      const across = (x - min[0]) / Math.max(0.001, max[0] - min[0]),
        vertical = (y - min[1]) / height;
      if (canonical[id] === "chest") {
        const along = Math.abs(x) / width;
        uv[p * 2] = along;
        uv[p * 2 + 1] = vertical - 0.12 * along * along;
      } else if (canonical[id] === "arms" || canonical[id] === "legs") {
        uv[p * 2] = vertical;
        uv[p * 2 + 1] =
          Math.atan2(z - (min[2] + max[2]) / 2, x - Math.sign(x) * meanAbsX) / (2 * Math.PI) + 0.5;
      } else if (canonical[id] === "shoulders") {
        uv[p * 2] = vertical;
        uv[p * 2 + 1] = across + 0.12 * vertical * vertical;
      } else {
        uv[p * 2] = across;
        uv[p * 2 + 1] = vertical - 0.06 * (2 * across - 1) ** 2;
      }
    }
    // Split wrap-seam UVs, retaining exactly identical positions and normals.
    // The integer phase offset is seamless for the shader's periodic fibers.
    if (canonical[id] === "arms" || canonical[id] === "legs") {
      const seamCopies = new Map();
      for (let at = 0; at < localIndices.length; at += 3) {
        const phase = [0, 1, 2].map((k) => uv[localIndices[at + k] * 2 + 1]);
        if (Math.max(...phase) - Math.min(...phase) <= 0.5) continue;
        for (let k = 0; k < 3; k++)
          if (phase[k] < 0.5) {
            const old = localIndices[at + k];
            if (!seamCopies.has(old)) {
              const copy = localPositions.length / 3;
              seamCopies.set(old, copy);
              for (let axis = 0; axis < 3; axis++) {
                localPositions.push(localPositions[old * 3 + axis]);
                localNormals.push(localNormals[old * 3 + axis]);
              }
              uv.push(uv[old * 2], uv[old * 2 + 1] + 1);
            }
            localIndices[at + k] = seamCopies.get(old);
          }
      }
      position.setArray(new Float32Array(localPositions));
      normal.setArray(new Float32Array(localNormals));
      primitive.getIndices().setArray(new Uint32Array(localIndices));
    }
    primitive.setAttribute(
      "TEXCOORD_0",
      document.createAccessor().setType("VEC2").setArray(new Float32Array(uv)).setBuffer(buffer),
    );
    const extras = {
      twinFiberUV: true,
      twinRegion: canonical[id],
      twinFiberUVVersion: "procedural-region-v1",
      twinFiberAnatomicallyValidated: false,
      uvContract: "u longitudinal; v phase across presentation fibers",
    };
    mesh.setExtras(extras);
    node.setExtras(extras);
  }
}
document.getRoot().getAsset().copyright =
  "BodyParts3D, (c) The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan";
document.getRoot().setExtras({
  candidateOnly: true,
  visualGatePassed: false,
  source: "BodyParts3D 4.0",
  geometryStrategy: "continuous registered skin wrap; superficial muscle projection",
  noPersonalBodyInference: true,
});
await document.transform(
  prune({ keepAttributes: true }),
  quantize({ pattern: /^(NORMAL|TEXCOORD_0)$/, quantizeNormal: 10 }),
);
document.createExtension(KHRMeshQuantization).setRequired(true);
const candidatePath = join(out, "twin-anatomy-continuous-candidate.glb");
await new NodeIO().registerExtensions(ALL_EXTENSIONS).write(candidatePath, document);
const audit = {
  candidateOnly: true,
  visualGatePassed: false,
  strategy: "continuous registered skin wrap",
  sourceSkin: rawSkinAudit,
  exteriorExtraction: exteriorAudit,
  baseline: await auditGlb(join(repo, "public/models/twin-anatomy-v1.glb")),
  candidate: await auditGlb(candidatePath),
  source: {
    skin: skinFiles.map((file) => ({ file, sha256: fileHash(join(objDir, `${file}.obj`)) })),
    elementsSha256: fileHash(elements),
    selectedSuperficialFiles: selection.length,
  },
  changes: {
    normalInflationMetres: 0,
    maximalMuscleDerivedInsetMetres: offsets.reduce((max, n) => Math.max(max, n), 0),
    collapsedPubicVertices: collapsed,
    groinSmoothingPasses: 90,
    taubinWeights: [0.12, -0.125, 0.12, -0.125],
    finalWeldMetres: 5e-5,
    authoredClosure: authoredClosure.audit,
    materialRegionTriangles: counts,
  },
  limits: [
    "No 1:1 visual approval",
    "Region borders are projected source correspondence, not independently authored muscle dissection",
    "Source atlas stance and proportions remain",
    "No anatomical fiber texture or validated fiber direction",
    "Self-intersection not exhaustively proven; GPU multi-angle review required",
  ],
  gates: {
    allCanonicalRegions: canonical.every((name) => counts[name] > 0),
    noGarmentMeshes: true,
    gpuMultiAngle: "pending",
    anatomicalReferenceSimilarity: "pending",
    productionIntegration: false,
  },
};
const finalTopology = audit.candidate.topologyAfterPositionWeld0_1Micrometres;
audit.gates.technicalTopologyPassed =
  finalTopology.edgeConnectedComponents === 1 &&
  finalTopology.boundaryEdges === 0 &&
  finalTopology.nonManifoldEdges === 0 &&
  finalTopology.nonManifoldVertices === 0 &&
  finalTopology.zeroAreaTriangles === 0 &&
  audit.candidate.degeneratesAtPrecision0_1Micrometres === 0 &&
  audit.candidate.duplicatesAtPrecision0_1Micrometres === 0;
if (!audit.gates.technicalTopologyPassed || !audit.gates.allCanonicalRegions) process.exitCode = 2;
writeFileSync(join(out, "anatomy-candidate.audit.json"), JSON.stringify(audit, null, 2) + "\n");
writeFileSync(
  join(out, "source-selection.json"),
  JSON.stringify(
    {
      selected: selection,
      interpretation:
        "Principal axes describe source geometry only. They are not validated fiber directions.",
      uvContract:
        "Regional TEXCOORD_0: u longitudinal; v phase across procedural presentation fibers. mesh/node extras.twinFiberUV=true; neutral has no UV. Chest curved horizontal chart; arms/legs longitudinal cylindrical chart. Not anatomically validated fiber directions; no raster texture added.",
      nextAuthoring:
        "Replace broad regional charts with reviewed per-muscle charts using named source parts, especially fan-shaped pectoral and deltoid directions.",
    },
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify(audit, null, 2));

function topology(positions, indices) {
  const count = positions.length / 3,
    parent = new Uint32Array(count),
    used = new Set(),
    edges = new Map();
  const faceLinks = Array.from({ length: indices.length / 3 }, () => []),
    firstFace = new Map(),
    vertexLinks = Array.from({ length: count }, () => new Map());
  for (let i = 0; i < count; i++) parent[i] = i;
  const find = (p) => {
    while (p !== parent[p]) {
      parent[p] = parent[parent[p]];
      p = parent[p];
    }
    return p;
  };
  const union = (a, b) => {
    a = find(a);
    b = find(b);
    if (a !== b) parent[b] = a;
  };
  let signedVolume = 0,
    area = 0,
    zeroAreaTriangles = 0;
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (let at = 0; at < indices.length; at += 3) {
    const tri = [indices[at], indices[at + 1], indices[at + 2]];
    for (let k = 0; k < 3; k++) {
      const a = tri[k],
        b = tri[(k + 1) % 3],
        key = a < b ? `${a},${b}` : `${b},${a}`;
      used.add(a);
      union(a, b);
      edges.set(key, (edges.get(key) ?? 0) + 1);
      if (firstFace.has(key)) {
        const other = firstFace.get(key);
        faceLinks[at / 3].push(other);
        faceLinks[other].push(at / 3);
      } else firstFace.set(key, at / 3);
      const c = tri[(k + 2) % 3],
        link = vertexLinks[a];
      if (!link.has(b)) link.set(b, new Set());
      if (!link.has(c)) link.set(c, new Set());
      link.get(b).add(c);
      link.get(c).add(b);
      for (let axis = 0; axis < 3; axis++) {
        min[axis] = Math.min(min[axis], positions[a * 3 + axis]);
        max[axis] = Math.max(max[axis], positions[a * 3 + axis]);
      }
    }
    const [a, b, c] = tri.map((p) => [
      positions[p * 3],
      positions[p * 3 + 1],
      positions[p * 3 + 2],
    ]);
    const u = b.map((v, i) => v - a[i]),
      v = c.map((v, i) => v - a[i]);
    const cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const triangleArea = Math.hypot(...cross) / 2;
    area += triangleArea;
    if (triangleArea < 1e-12) zeroAreaTriangles++;
    signedVolume +=
      (a[0] * (b[1] * c[2] - b[2] * c[1]) +
        a[1] * (b[2] * c[0] - b[0] * c[2]) +
        a[2] * (b[0] * c[1] - b[1] * c[0])) /
      6;
  }
  const components = new Map();
  for (const p of used) {
    const root = find(p);
    components.set(root, (components.get(root) ?? 0) + 1);
  }
  const faceVisited = new Uint8Array(faceLinks.length),
    edgeComponents = [];
  for (let t = 0; t < faceLinks.length; t++)
    if (!faceVisited[t]) {
      const queue = [t];
      faceVisited[t] = 1;
      for (let i = 0; i < queue.length; i++)
        for (const other of faceLinks[queue[i]])
          if (!faceVisited[other]) {
            faceVisited[other] = 1;
            queue.push(other);
          }
      edgeComponents.push(queue.length);
    }
  let nonManifoldVertices = 0;
  for (const p of used) {
    const links = vertexLinks[p],
      seen = new Set(),
      queue = [links.keys().next().value];
    seen.add(queue[0]);
    for (let i = 0; i < queue.length; i++)
      for (const other of links.get(queue[i]))
        if (!seen.has(other)) {
          seen.add(other);
          queue.push(other);
        }
    if (seen.size !== links.size || [...links.values()].some((around) => around.size > 2))
      nonManifoldVertices++;
  }
  return {
    vertices: used.size,
    triangles: indices.length / 3,
    connectedComponents: components.size,
    connectivityMeaning: "vertex adjacency",
    componentVertexCounts: [...components.values()].sort((a, b) => b - a),
    edgeConnectedComponents: edgeComponents.length,
    edgeComponentTriangleCounts: edgeComponents.sort((a, b) => b - a),
    nonManifoldVertices,
    boundaryEdges: [...edges.values()].filter((n) => n === 1).length,
    nonManifoldEdges: [...edges.values()].filter((n) => n > 2).length,
    zeroAreaTriangles,
    surfaceAreaM2: area,
    signedVolumeM3: signedVolume,
    boundsMetres: { min, max },
  };
}
async function auditGlb(path) {
  const bytes = readFileSync(path),
    array = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const gltf = await new Promise((resolve, reject) =>
    new GLTFLoader().parse(array, "", resolve, reject),
  );
  gltf.scene.updateMatrixWorld(true);
  const positions = [],
    indices = [],
    regions = [],
    point = new Vector3();
  gltf.scene.traverse((object) => {
    if (!object.isMesh) return;
    const pos = object.geometry.getAttribute("position"),
      ind = object.geometry.getIndex(),
      base = positions.length / 3;
    for (let at = 0; at < pos.count; at++) {
      point.fromBufferAttribute(pos, at).applyMatrix4(object.matrixWorld);
      positions.push(point.x, point.y, point.z);
    }
    for (let at = 0; at < (ind ? ind.count : pos.count); at++)
      indices.push(base + (ind ? ind.getX(at) : at));
    regions.push({
      name: object.material.name,
      triangles: (ind ? ind.count : pos.count) / 3,
      hasUv: Boolean(object.geometry.getAttribute("uv")),
      fiberMetadata: object.userData.twinFiberUV === true,
    });
  });
  const welded = clean(positions, indices, 1e-5);
  const exact = clean(positions, indices, 1e-7);
  return {
    file: path,
    sha256: sha(bytes),
    bytes: bytes.length,
    gzipBytes: gzipSync(bytes).length,
    regions,
    topologyAfterPositionWeld0_1Micrometres: topology(exact.positions, exact.indices),
    degeneratesAtPrecision0_1Micrometres: exact.degenerateRemoved,
    duplicatesAtPrecision0_1Micrometres: exact.duplicateRemoved,
    topologyAfterPositionWeld10Micrometres: topology(welded.positions, welded.indices),
    coincidentDegenerateTrianglesRemovedForAudit: welded.degenerateRemoved,
    duplicateTrianglesRemovedForAudit: welded.duplicateRemoved,
  };
}
