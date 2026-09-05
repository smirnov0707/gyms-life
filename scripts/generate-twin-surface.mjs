/**
 * GYMS.LIFE generic studio body, authored from explicit shape primitives.
 * Build-time asset generation only: no scan, population data or user inputs.
 * Run: node scripts/generate-twin-surface.mjs
 * The shipped renderer does NOT evaluate this field or extract surfaces.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { MeshoptSimplifier } from "meshoptimizer";

const STEP = 0.014;
const SCALE = 10000;
const ORIGIN = [-0.49, -0.028, -0.238];
const SIZE = [71, 139, 36];
const [NX, NY, NZ] = SIZE;
const GROUPS = ["neutral", "chest", "back", "shoulders", "arms", "legs", "glutes", "core", "abs"];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const mix = (a, b, t) => a + (b - a) * t;
const smoothMin = (a, b, k) => {
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return mix(b, a, h) - k * h * (1 - h);
};
const primitives = [];
function ellipsoid(center, radii, blend = 0.025, roll = 0) {
  const c = Math.cos(roll),
    s = Math.sin(roll);
  primitives.push({
    center,
    radius: Math.max(...radii) + blend * 2,
    blend,
    distance(x, y, z) {
      const dx = x - center[0],
        dy = y - center[1],
        dz = z - center[2];
      const px = c * dx + s * dy,
        py = -s * dx + c * dy;
      const k0 = Math.hypot(px / radii[0], py / radii[1], dz / radii[2]);
      const k1 = Math.hypot(px / radii[0] ** 2, py / radii[1] ** 2, dz / radii[2] ** 2);
      return k1 < 1e-12 ? -Math.min(...radii) : (k0 * (k0 - 1)) / k1;
    },
  });
}
function taperedLimb(a, b, radiusA, radiusB, depth = 0.9, blend = 0.024) {
  const vx = b[0] - a[0],
    vy = b[1] - a[1],
    vz = b[2] - a[2];
  const len2 = vx * vx + vy * vy + vz * vz;
  primitives.push({
    center: a.map((v, i) => (v + b[i]) / 2),
    radius: Math.sqrt(len2) / 2 + Math.max(radiusA, radiusB) + blend * 2,
    blend,
    distance(x, y, z) {
      const dx = x - a[0],
        dy = y - a[1],
        dz = z - a[2];
      const t = clamp((dx * vx + dy * vy + dz * vz) / len2, 0, 1);
      return Math.hypot(dx - vx * t, dy - vy * t, (dz - vz * t) / depth) - mix(radiusA, radiusB, t);
    },
  });
}

// One blended trunk: a generic adult silhouette, not a recommended body goal.
ellipsoid([0, 1.319, -0.003], [0.188, 0.19, 0.11], 0.045);
ellipsoid([0, 1.141, -0.01], [0.139, 0.196, 0.092], 0.05);
ellipsoid([0, 0.988, -0.005], [0.156, 0.137, 0.105], 0.045);
ellipsoid([0, 1.453, -0.006], [0.198, 0.061, 0.085], 0.035);
taperedLimb([0, 1.488, -0.012], [0, 1.627, -0.014], 0.056, 0.049, 0.98, 0.03);
// Skull, cheek and jaw form one surface. Facial cues are intentionally generic.
ellipsoid([0, 1.741, -0.013], [0.077, 0.111, 0.086], 0.019);
ellipsoid([0, 1.677, 0.007], [0.061, 0.061, 0.07], 0.02);
ellipsoid([0, 1.649, 0.025], [0.04, 0.025, 0.04], 0.013);
ellipsoid([0, 1.714, 0.072], [0.01, 0.028, 0.018], 0.01);
for (const side of [-1, 1]) {
  // Pectorals merge into the ribcage instead of floating on it.
  ellipsoid([side * 0.087, 1.359, 0.071], [0.104, 0.068, 0.05], 0.03, -side * 0.07);
  ellipsoid([side * 0.079, 1.389, -0.071], [0.087, 0.093, 0.043], 0.029);
  ellipsoid([side * 0.12, 1.269, -0.04], [0.066, 0.15, 0.061], 0.035, -side * 0.15);
  // Connected shoulder/arm sweep, without exposed ball joints.
  ellipsoid([side * 0.213, 1.418, -0.006], [0.065, 0.079, 0.068], 0.034, side * 0.17);
  taperedLimb(
    [side * 0.231, 1.409, -0.006],
    [side * 0.311, 1.131, 0.006],
    0.054,
    0.034,
    0.98,
    0.028,
  );
  ellipsoid([side * 0.266, 1.287, 0.014], [0.047, 0.118, 0.048], 0.022, side * 0.29);
  taperedLimb([side * 0.311, 1.13, 0.006], [side * 0.359, 0.884, 0.025], 0.033, 0.021, 0.92, 0.024);
  ellipsoid([side * 0.328, 1.051, 0.01], [0.037, 0.088, 0.033], 0.02, side * 0.2);
  // Palm and gently grouped fingers; no implied fine motor measurement.
  ellipsoid([side * 0.367, 0.841, 0.028], [0.03, 0.056, 0.018], 0.02, side * 0.15);
  for (let finger = 0; finger < 4; finger++) {
    const x = side * (0.348 + finger * 0.012);
    taperedLimb(
      [x, 0.815, 0.03],
      [x + side * 0.009, 0.755 + Math.abs(finger - 1.3) * 0.01, 0.037],
      0.0075,
      0.006,
      0.95,
      0.006,
    );
  }
  taperedLimb(
    [side * 0.344, 0.861, 0.031],
    [side * 0.326, 0.813, 0.047],
    0.011,
    0.0075,
    0.95,
    0.01,
  );
  // Posterior pelvis blends into thighs; knees and ankles stay connected.
  ellipsoid([side * 0.078, 0.956, -0.06], [0.087, 0.095, 0.081], 0.029);
  taperedLimb(
    [side * 0.082, 0.944, -0.003],
    [side * 0.099, 0.547, 0.014],
    0.087,
    0.047,
    1.02,
    0.028,
  );
  ellipsoid([side * 0.091, 0.77, 0.022], [0.077, 0.154, 0.074], 0.018, side * 0.035);
  taperedLimb([side * 0.099, 0.547, 0.014], [side * 0.1, 0.143, -0.013], 0.043, 0.026, 1.06, 0.023);
  ellipsoid([side * 0.1, 0.387, -0.025], [0.049, 0.13, 0.051], 0.023);
  ellipsoid([side * 0.1, 0.095, 0.008], [0.037, 0.055, 0.056], 0.02);
  ellipsoid([side * 0.104, 0.065, 0.076], [0.047, 0.032, 0.09], 0.021);
}

const field = new Float32Array(NX * NY * NZ).fill(1);
const node = (x, y, z) => (z * NY + y) * NX + x;
// Only bounded primitive regions are evaluated. This never runs on a phone.
for (const shape of primitives) {
  const start = shape.center.map((v, i) =>
    clamp(Math.floor((v - shape.radius - ORIGIN[i]) / STEP), 0, SIZE[i] - 1),
  );
  const end = shape.center.map((v, i) =>
    clamp(Math.ceil((v + shape.radius - ORIGIN[i]) / STEP), 0, SIZE[i] - 1),
  );
  for (let z = start[2]; z <= end[2]; z++) {
    for (let y = start[1]; y <= end[1]; y++) {
      for (let x = start[0]; x <= end[0]; x++) {
        const id = node(x, y, z);
        const distance = shape.distance(
          ORIGIN[0] + x * STEP,
          ORIGIN[1] + y * STEP,
          ORIGIN[2] + z * STEP,
        );
        field[id] = smoothMin(field[id], distance, shape.blend);
      }
    }
  }
}

let positions = [];
let indices = [];
const cache = new Map();
const corners = [
  [0, 0, 0],
  [1, 0, 0],
  [1, 1, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [1, 1, 1],
  [0, 1, 1],
];
// A common cube diagonal makes shared face subdivisions conforming.
const tetrahedra = [
  [0, 5, 1, 6],
  [0, 1, 2, 6],
  [0, 2, 3, 6],
  [0, 3, 7, 6],
  [0, 7, 4, 6],
  [0, 4, 5, 6],
];
function edge(a, b, pa, pb) {
  const key = Math.min(a, b) * field.length + Math.max(a, b);
  const existing = cache.get(key);
  if (existing !== undefined) return existing;
  const t = field[a] / (field[a] - field[b]);
  const id = positions.length / 3;
  positions.push(...pa.map((v, i) => mix(v, pb[i], t)));
  cache.set(key, id);
  return id;
}
function triangle(a, b, c, outward) {
  const ax = positions[b * 3] - positions[a * 3],
    ay = positions[b * 3 + 1] - positions[a * 3 + 1],
    az = positions[b * 3 + 2] - positions[a * 3 + 2];
  const bx = positions[c * 3] - positions[a * 3],
    by = positions[c * 3 + 1] - positions[a * 3 + 1],
    bz = positions[c * 3 + 2] - positions[a * 3 + 2];
  const dot =
    (ay * bz - az * by) * outward[0] +
    (az * bx - ax * bz) * outward[1] +
    (ax * by - ay * bx) * outward[2];
  indices.push(...(dot >= 0 ? [a, b, c] : [a, c, b]));
}
for (let z = 0; z < NZ - 1; z++)
  for (let y = 0; y < NY - 1; y++)
    for (let x = 0; x < NX - 1; x++) {
      const ids = corners.map(([dx, dy, dz]) => node(x + dx, y + dy, z + dz));
      if (ids.every((id) => field[id] >= 0) || ids.every((id) => field[id] < 0)) continue;
      const points = corners.map(([dx, dy, dz]) => [
        ORIGIN[0] + (x + dx) * STEP,
        ORIGIN[1] + (y + dy) * STEP,
        ORIGIN[2] + (z + dz) * STEP,
      ]);
      for (const tetra of tetrahedra) {
        const inside = tetra.filter((i) => field[ids[i]] < 0),
          outside = tetra.filter((i) => field[ids[i]] >= 0);
        if (!inside.length || !outside.length) continue;
        const outward = [0, 1, 2].map(
          (axis) =>
            outside.reduce((sum, i) => sum + points[i][axis], 0) / outside.length -
            inside.reduce((sum, i) => sum + points[i][axis], 0) / inside.length,
        );
        const cut = (a, b) => edge(ids[a], ids[b], points[a], points[b]);
        if (inside.length === 1) triangle(...outside.map((i) => cut(inside[0], i)), outward);
        else if (outside.length === 1) triangle(...inside.map((i) => cut(outside[0], i)), outward);
        else {
          const [a, b] = inside,
            [c, d] = outside;
          const ac = cut(a, c),
            ad = cut(a, d),
            bc = cut(b, c),
            bd = cut(b, d);
          triangle(ac, ad, bd, outward);
          triangle(ac, bd, bc, outward);
        }
      }
    }

// Volume-preserving smoothing removes tetrahedral sampling ripples.
const neighbours = Array.from({ length: positions.length / 3 }, () => new Set());
for (let i = 0; i < indices.length; i += 3) {
  const [a, b, c] = indices.slice(i, i + 3);
  neighbours[a].add(b).add(c);
  neighbours[b].add(a).add(c);
  neighbours[c].add(a).add(b);
}
for (const strength of [0.45, -0.47, 0.45, -0.47]) {
  const next = positions.slice();
  for (let i = 0; i < neighbours.length; i++)
    for (let axis = 0; axis < 3; axis++) {
      let avg = 0;
      for (const other of neighbours[i]) avg += positions[other * 3 + axis];
      next[i * 3 + axis] += strength * (avg / neighbours[i].size - positions[i * 3 + axis]);
    }
  positions = next;
}

// Offline simplification keeps a detailed silhouette without a large GPU mesh.
// Error is a geometric approximation bound, NOT uncertainty about a person's body.
await MeshoptSimplifier.ready;
// Preserve shared colour-zone boundary edges during offline simplification.
const rawGroups = Object.fromEntries(GROUPS.map((name) => [name, []]));
for (let i = 0; i < indices.length; i += 3) {
  const face = indices.slice(i, i + 3);
  const centre = [0, 1, 2].map(
    (axis) => face.reduce((sum, id) => sum + positions[id * 3 + axis], 0) / 3,
  );
  rawGroups[regionAt(...centre)].push(...face);
}
let reducedIndices = [];
const floatPositions = new Float32Array(positions);
for (const group of Object.values(rawGroups)) {
  const target = Math.max(3, Math.floor((group.length / indices.length) * 16000) * 3);
  const [reduced] = MeshoptSimplifier.simplify(
    new Uint32Array(group),
    floatPositions,
    3,
    target,
    0.001,
    ["LockBorder"],
  );
  reducedIndices.push(...reduced);
}
// Simplification can collapse a tiny tetrahedral spur to two coincident,
// oppositely wound faces. These enclose zero volume; remove BOTH faces.
// Other duplicates or significant removals fail rather than hide a defect.
const duplicateFaces = new Map();
for (let i = 0; i < reducedIndices.length; i += 3) {
  const face = reducedIndices.slice(i, i + 3);
  const key = [...face].sort((a, b) => a - b).join(":");
  const records = duplicateFaces.get(key) ?? [];
  const parity =
    ((face[0] > face[1] ? 1 : 0) + (face[0] > face[2] ? 1 : 0) + (face[1] > face[2] ? 1 : 0)) % 2;
  records.push({ offset: i, parity });
  duplicateFaces.set(key, records);
}
const removeOffsets = new Set();
for (const records of duplicateFaces.values()) {
  if (records.length === 1) continue;
  if (records.length !== 2 || records[0].parity === records[1].parity) {
    throw new Error("Unexpected duplicated surface faces require review");
  }
  records.forEach(({ offset }) => removeOffsets.add(offset));
}
if (removeOffsets.size * 3 > reducedIndices.length * 0.001) {
  throw new Error("Excess zero-volume surface faces require review");
}
reducedIndices = reducedIndices.filter((_, index) => !removeOffsets.has(index - (index % 3)));
// Tiny disconnected sampling islands are not anatomy. Keep the dominant
// closed surface, failing rather than hiding a meaningful disconnection.
const connections = new Map();
for (let i = 0; i < reducedIndices.length; i += 3) {
  const face = reducedIndices.slice(i, i + 3);
  for (let j = 0; j < 3; j++) {
    const a = face[j],
      b = face[(j + 1) % 3];
    if (!connections.has(a)) connections.set(a, new Set());
    connections.get(a).add(b);
  }
}
const remaining = new Set(connections.keys());
let largest = new Set();
while (remaining.size) {
  const component = new Set();
  const pending = [remaining.values().next().value];
  while (pending.length) {
    const vertex = pending.pop();
    if (component.has(vertex)) continue;
    component.add(vertex);
    remaining.delete(vertex);
    for (const other of connections.get(vertex)) if (!component.has(other)) pending.push(other);
  }
  if (component.size > largest.size) largest = component;
}
const connected = [];
for (let i = 0; i < reducedIndices.length; i += 3) {
  if (largest.has(reducedIndices[i])) connected.push(...reducedIndices.slice(i, i + 3));
}
if (connected.length < reducedIndices.length * 0.99)
  throw new Error("Meaningful body disconnection requires review");
// The baked outer surface must be manifold and consistently oriented.
const edgeUse = new Map();
for (let i = 0; i < connected.length; i += 3) {
  const face = connected.slice(i, i + 3);
  for (let j = 0; j < 3; j++) {
    const a = face[j],
      b = face[(j + 1) % 3];
    const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
    const value = edgeUse.get(key) ?? { count: 0, orientation: 0 };
    value.count++;
    value.orientation += a < b ? 1 : -1;
    edgeUse.set(key, value);
  }
}
if ([...edgeUse.values()].some(({ count, orientation }) => count !== 2 || orientation !== 0)) {
  throw new Error("Baked body must form a closed consistently oriented manifold");
}
const simplified = new Uint32Array(connected);
const [remap, vertexCount] = MeshoptSimplifier.compactMesh(simplified);
const compact = new Array(vertexCount * 3).fill(0);
for (let i = 0; i < remap.length; i++) {
  if (remap[i] === 0xffffffff) continue;
  for (let axis = 0; axis < 3; axis++) compact[remap[i] * 3 + axis] = positions[i * 3 + axis];
}
positions = compact;
indices = Array.from(simplified);

/** Broad display zones, never individual-muscle or left/right measurements. */
function regionAt(x, y, z) {
  const a = Math.abs(x);
  if (y > 1.52) return "neutral";
  if (a > 0.18 && y > 1.354) return "shoulders";
  const armBoundary = y > 1.12 ? 0.202 + (1.35 - y) * 0.2 : 0.255;
  if (a > armBoundary && y > 0.718) return "arms";
  if (y < 0.886) return "legs";
  if (z < -0.042 && y < 1.051) return "glutes";
  if (y < 1.006) return "neutral";
  if (z < -0.012) return "back";
  if (y > 1.275 && z > 0.024) return "chest";
  if (y <= 1.278 && z > 0.064 && a < 0.08) return "abs";
  if (y < 1.295) return "core";
  return "neutral";
}
const groups = Object.fromEntries(GROUPS.map((name) => [name, []]));
for (let i = 0; i < indices.length; i += 3) {
  const face = indices.slice(i, i + 3);
  const point = [0, 1, 2].map(
    (axis) => face.reduce((sum, id) => sum + positions[id * 3 + axis], 0) / 3,
  );
  groups[regionAt(...point)].push(...face);
}
const output = {
  version: "generic-human-surface-1",
  scale: SCALE,
  positions: positions.map((v) => Math.round(v * SCALE)),
  groups,
};
const text = JSON.stringify(output) + "\n";
const gzipBytes = gzipSync(text).length;
if (indices.length / 3 > 24000 || positions.length / 3 > 15000 || gzipBytes > 210000)
  throw new Error("Twin surface exceeds the declared asset budget");
const out = resolve(
  process.env.TWIN_SURFACE_OUTPUT ?? "src/components/twin/twin-body.surface.json",
);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, text);
console.log(
  JSON.stringify(
    {
      vertices: positions.length / 3,
      triangles: indices.length / 3,
      gzipBytes,
      groups: Object.fromEntries(
        Object.entries(groups).map(([name, faces]) => [name, faces.length / 3]),
      ),
    },
    null,
    2,
  ),
);
