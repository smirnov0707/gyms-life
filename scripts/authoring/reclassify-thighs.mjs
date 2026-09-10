/** Source correspondence changes material ownership, never vertex positions. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
export function reclassifyThighs({
  sourceDir,
  selectionPath,
  original,
  posed,
  triangles,
  primitives,
  normals,
}) {
  const rawSkin = [];
  for (const line of readFileSync(join(sourceDir, "FJ2810.obj"), "latin1").split("\n"))
    if (line.startsWith("v ")) {
      const [, x, y, z] = line.trim().split(/\s+/).map(Number);
      rawSkin.push(x, z, -y);
    }
  let cx = 0,
    cz = 0,
    lo = Infinity,
    hi = -Infinity;
  for (let i = 0; i < rawSkin.length; i += 3) {
    cx += rawSkin[i];
    cz += rawSkin[i + 2];
    lo = Math.min(lo, rawSkin[i + 1]);
    hi = Math.max(hi, rawSkin[i + 1]);
  }
  cx /= rawSkin.length / 3;
  cz /= rawSkin.length / 3;
  const scale = 1.7 / (hi - lo);
  const selection = JSON.parse(readFileSync(selectionPath)).selected,
    points = [];
  for (let file = 0; file < selection.length; file++) {
    const item = selection[file];
    if (!/^FJ[0-9]+M?$/.test(item.file)) throw new Error("Invalid source part identifier");
    const bytes = readFileSync(join(sourceDir, item.file + ".obj"));
    if (createHash("sha256").update(bytes).digest("hex") !== item.sha256)
      throw new Error("Source part hash mismatch: " + item.file);
    for (const line of bytes.toString("latin1").split("\n"))
      if (line.startsWith("v ")) {
        const [, x, y, z] = line.trim().split(/\s+/).map(Number);
        points.push((x - cx) * scale, (z - lo) * scale, (-y - cz) * scale, file);
      }
  }
  const order = Array.from({ length: points.length / 4 }, (_, i) => i),
    left = new Int32Array(order.length).fill(-1),
    right = new Int32Array(order.length).fill(-1),
    tree = new Uint32Array(order.length);
  const swap = (a, b) => {
    const v = order[a];
    order[a] = order[b];
    order[b] = v;
  };
  function select(lo, hi, wanted, axis) {
    while (lo < hi) {
      const pivot = points[order[(lo + hi) >> 1] * 4 + axis];
      let a = lo,
        b = lo,
        c = hi;
      while (b <= c) {
        const value = points[order[b] * 4 + axis];
        if (value < pivot) swap(a++, b++);
        else if (value > pivot) swap(b, c--);
        else b++;
      }
      if (wanted < a) hi = a - 1;
      else if (wanted > c) lo = c + 1;
      else return;
    }
  }
  function build(lo, hi, depth = 0) {
    if (lo > hi) return -1;
    const mid = (lo + hi) >> 1;
    select(lo, hi, mid, depth % 3);
    tree[mid] = order[mid];
    left[mid] = build(lo, mid - 1, depth + 1);
    right[mid] = build(mid + 1, hi, depth + 1);
    return mid;
  }
  const root = build(0, order.length - 1);
  function nearest(p) {
    let best = 0.045 ** 2,
      found = -1;
    function visit(node, depth) {
      if (node < 0) return;
      const at = tree[node] * 4,
        d = (p[0] - points[at]) ** 2 + (p[1] - points[at + 1]) ** 2 + (p[2] - points[at + 2]) ** 2;
      if (d < best) {
        best = d;
        found = points[at + 3];
      }
      const delta = p[depth % 3] - points[at + (depth % 3)];
      visit(delta < 0 ? left[node] : right[node], depth + 1);
      if (delta * delta < best) visit(delta < 0 ? right[node] : left[node], depth + 1);
    }
    visit(root, 0);
    return found < 0 ? null : { item: selection[found], distance: Math.sqrt(best) };
  }
  const neutral = primitives.find((p) => p.name === "twin-region:neutral"),
    keep = [],
    moved = new Map(),
    evidence = [];
  let candidates = 0,
    pubicExcluded = 0;
  const neutralIndices = neutral.indices.getArray();
  for (let at = 0; at < neutralIndices.length; at += 3) {
    const ids = [0, 1, 2].map((k) => neutral.local[neutralIndices[at + k]]),
      p = [0, 1, 2].map((k) => ids.reduce((sum, id) => sum + original[id * 3 + k], 0) / 3);
    let match = null;
    if (p[1] >= 0.68 && p[1] <= 0.918 && Math.abs(p[0]) <= 0.125 && p[2] > 0) {
      candidates++;
      if ((p[0] / 0.036) ** 2 + ((p[1] - 0.835) / 0.083) ** 2 < 1) pubicExcluded++;
      else match = nearest(p);
    }
    if (match) {
      const name = "twin-region:" + match.item.region;
      if (!moved.has(name)) moved.set(name, []);
      moved.get(name).push(...ids);
      evidence.push({
        sourceTriangle: neutral.offset / 3 + at / 3,
        region: match.item.region,
        sourcePart: match.item.file,
        sourceName: match.item.anatomicalName,
        distanceMetres: match.distance,
      });
    } else keep.push(neutralIndices[at], neutralIndices[at + 1], neutralIndices[at + 2]);
  }
  neutral.indices.setArray(new Uint32Array(keep));
  for (const [name, ids] of moved) {
    const item = primitives.find((p) => p.name === name);
    if (!item?.uv) throw new Error("Expected existing canonical fiber UV region " + name);
    const oldCount = item.position.getCount(),
      oldPos = item.position.getArray(),
      oldNorm = item.normal.getArray(),
      oldUv = item.uv.getArray(),
      oldInd = item.indices.getArray();
    const positions = new Float32Array(oldPos.length + ids.length * 3),
      encodedNormals = new oldNorm.constructor(oldNorm.length + ids.length * 3),
      uv = new Float32Array(oldUv.length + ids.length * 2),
      indices = new Uint32Array(oldInd.length + ids.length);
    positions.set(oldPos);
    encodedNormals.set(oldNorm);
    uv.set(oldUv);
    indices.set(oldInd);
    item.normal.setArray(encodedNormals);
    const existing = new Map();
    for (let i = 0; i < item.local.length; i++)
      if (!existing.has(item.local[i]))
        existing.set(item.local[i], [oldUv[i * 2], oldUv[i * 2 + 1]]);
    const min = [Infinity, Infinity, Infinity],
      max = [-Infinity, -Infinity, -Infinity];
    let meanAbsX = 0;
    for (const id of existing.keys()) {
      meanAbsX += Math.abs(original[id * 3]) / existing.size;
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], original[id * 3 + k]);
        max[k] = Math.max(max[k], original[id * 3 + k]);
      }
    }
    const region = name.slice("twin-region:".length),
      width = Math.max(Math.abs(min[0]), Math.abs(max[0]), 0.001),
      height = Math.max(0.001, max[1] - min[1]);
    function chart(id) {
      if (existing.has(id)) return existing.get(id).slice();
      const [x, y, z] = original.slice(id * 3, id * 3 + 3),
        u = (x - min[0]) / Math.max(0.001, max[0] - min[0]),
        v = (y - min[1]) / height;
      if (region === "legs" || region === "arms")
        return [
          v,
          Math.atan2(z - (min[2] + max[2]) / 2, x - Math.sign(x) * meanAbsX) / (2 * Math.PI) + 0.5,
        ];
      if (region === "chest") {
        const a = Math.abs(x) / width;
        return [a, v - 0.12 * a * a];
      }
      if (region === "shoulders") return [v, u + 0.12 * v * v];
      return [u, v - 0.06 * (2 * u - 1) ** 2];
    }
    for (let at = 0; at < ids.length; at += 3) {
      const coords = [0, 1, 2].map((k) => chart(ids[at + k]));
      if (region === "legs" || region === "arms") {
        const first = coords[0][1];
        for (const p of coords) {
          while (p[1] - first > 0.5) p[1]--;
          while (p[1] - first < -0.5) p[1]++;
        }
      }
      for (let k = 0; k < 3; k++) {
        const id = ids[at + k],
          local = oldCount + at + k;
        positions.set(posed.subarray(id * 3, id * 3 + 3), local * 3);
        item.normal.setElement(local, Array.from(normals.subarray(id * 3, id * 3 + 3)));
        uv.set(coords[k], local * 2);
        indices[oldInd.length + at + k] = local;
      }
    }
    item.position.setArray(positions);
    item.uv.setArray(uv);
    item.indices.setArray(indices);
  }
  return {
    method:
      "Decouple protected geometry from region labeling. Relabel neutral old-mask faces by nearest registered superficial muscle source in rest coordinates; no position changes.",
    oldMaskCandidateTriangles: candidates,
    narrowPubicTrianglesRetained: pubicExcluded,
    reclassifiedTriangles: evidence.length,
    byRegion: Object.fromEntries([...moved].map(([k, v]) => [k, v.length / 3])),
    triangleCountPreserved:
      primitives.reduce((sum, p) => sum + p.indices.getCount() / 3, 0) === triangles.length / 3,
    sourceEvidence: evidence,
  };
}
