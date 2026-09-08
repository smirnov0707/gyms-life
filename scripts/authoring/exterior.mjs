/** Extract only faces visible from the exterior of BP3D's thin skin organ. */
export function exteriorSkin(positions, indices) {
  const count = indices.length / 3,
    order = Array.from({ length: count }, (_, i) => i);
  const bounds = new Float64Array(count * 6),
    centres = new Float64Array(count * 3),
    normals = new Float64Array(count * 3);
  for (let t = 0; t < count; t++) {
    const a = indices[t * 3] * 3,
      b = indices[t * 3 + 1] * 3,
      c = indices[t * 3 + 2] * 3;
    for (let k = 0; k < 3; k++) {
      bounds[t * 6 + k] = Math.min(positions[a + k], positions[b + k], positions[c + k]);
      bounds[t * 6 + 3 + k] = Math.max(positions[a + k], positions[b + k], positions[c + k]);
      centres[t * 3 + k] = (positions[a + k] + positions[b + k] + positions[c + k]) / 3;
    }
    const u = [0, 1, 2].map((k) => positions[b + k] - positions[a + k]),
      v = [0, 1, 2].map((k) => positions[c + k] - positions[a + k]);
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]],
      length = Math.hypot(...n) || 1;
    for (let k = 0; k < 3; k++) normals[t * 3 + k] = n[k] / length;
  }
  const nodes = [];
  function build(lo, hi) {
    const min = [Infinity, Infinity, Infinity],
      max = [-Infinity, -Infinity, -Infinity];
    for (let i = lo; i <= hi; i++)
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], bounds[order[i] * 6 + k]);
        max[k] = Math.max(max[k], bounds[order[i] * 6 + k + 3]);
      }
    const id = nodes.length,
      node = { min, max, lo, hi, left: -1, right: -1 };
    nodes.push(node);
    if (hi - lo > 8) {
      const axis = [0, 1, 2].sort((a, b) => max[b] - min[b] - (max[a] - min[a]))[0];
      const sorted = order
        .slice(lo, hi + 1)
        .sort((a, b) => centres[a * 3 + axis] - centres[b * 3 + axis]);
      for (let i = 0; i < sorted.length; i++) order[lo + i] = sorted[i];
      const mid = (lo + hi) >> 1;
      node.left = build(lo, mid);
      node.right = build(mid + 1, hi);
    }
    return id;
  }
  build(0, count - 1);
  function blocked(origin, direction, skip) {
    function box(node) {
      let near = 0,
        far = Infinity;
      for (let k = 0; k < 3; k++) {
        if (Math.abs(direction[k]) < 1e-12) {
          if (origin[k] < node.min[k] || origin[k] > node.max[k]) return false;
        } else {
          const a = (node.min[k] - origin[k]) / direction[k],
            b = (node.max[k] - origin[k]) / direction[k];
          near = Math.max(near, Math.min(a, b));
          far = Math.min(far, Math.max(a, b));
          if (far < near) return false;
        }
      }
      return true;
    }
    function hit(t) {
      if (t === skip) return false;
      const a = indices[t * 3] * 3,
        b = indices[t * 3 + 1] * 3,
        c = indices[t * 3 + 2] * 3;
      const ux = positions[b] - positions[a],
        uy = positions[b + 1] - positions[a + 1],
        uz = positions[b + 2] - positions[a + 2];
      const vx = positions[c] - positions[a],
        vy = positions[c + 1] - positions[a + 1],
        vz = positions[c + 2] - positions[a + 2];
      const px = direction[1] * vz - direction[2] * vy,
        py = direction[2] * vx - direction[0] * vz,
        pz = direction[0] * vy - direction[1] * vx;
      const det = ux * px + uy * py + uz * pz;
      if (Math.abs(det) < 1e-14) return false;
      const sx = origin[0] - positions[a],
        sy = origin[1] - positions[a + 1],
        sz = origin[2] - positions[a + 2],
        inv = 1 / det;
      const u = (sx * px + sy * py + sz * pz) * inv;
      if (u < 0 || u > 1) return false;
      const qx = sy * uz - sz * uy,
        qy = sz * ux - sx * uz,
        qz = sx * uy - sy * ux;
      const v = (direction[0] * qx + direction[1] * qy + direction[2] * qz) * inv;
      if (v < 0 || u + v > 1) return false;
      return (vx * qx + vy * qy + vz * qz) * inv > 1e-7;
    }
    function visit(id) {
      const node = nodes[id];
      if (!box(node)) return false;
      if (node.left < 0) {
        for (let at = node.lo; at <= node.hi; at++) if (hit(order[at])) return true;
        return false;
      }
      return visit(node.left) || visit(node.right);
    }
    return visit(0);
  }
  const visible = new Uint8Array(count),
    directions = [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ];
  let rays = 0;
  for (let t = 0; t < count; t++) {
    const n = Array.from(normals.subarray(t * 3, t * 3 + 3)),
      origin = [0, 1, 2].map((k) => centres[t * 3 + k] + n[k] * 1e-6);
    // Favour the face normal, then the three outward-facing axis directions.
    for (const d of [n, ...directions]) {
      if (d[0] * n[0] + d[1] * n[1] + d[2] * n[2] < 0.02) continue;
      rays++;
      if (!blocked(origin, d, t)) {
        visible[t] = 1;
        break;
      }
    }
  }
  // Fill isolated visibility misses only when all but one adjacent face is exterior.
  const edges = new Map(),
    adjacency = Array.from({ length: count }, () => []);
  for (let t = 0; t < count; t++)
    for (let k = 0; k < 3; k++) {
      const a = indices[t * 3 + k],
        b = indices[t * 3 + ((k + 1) % 3)],
        key = a < b ? `${a},${b}` : `${b},${a}`;
      if (edges.has(key)) {
        const other = edges.get(key);
        adjacency[t].push(other);
        adjacency[other].push(t);
      } else edges.set(key, t);
    }
  // Interior surfaces remain excluded; four local passes close single-triangle misses.
  for (let pass = 0; pass < 4; pass++) {
    const next = visible.slice();
    for (let t = 0; t < count; t++)
      if (!visible[t] && adjacency[t].filter((other) => visible[other]).length === 3) next[t] = 1;
    visible.set(next);
  }
  const kept = [];
  for (let t = 0; t < count; t++)
    if (visible[t]) kept.push(indices[t * 3], indices[t * 3 + 1], indices[t * 3 + 2]);
  return {
    positions,
    indices: new Uint32Array(kept),
    audit: {
      sourceFaces: count,
      exteriorFaces: kept.length / 3,
      removedInnerOrOccludedFaces: count - kept.length / 3,
      visibilityRays: rays,
      method:
        "Positive-normal ray escape (normal plus six axes), isolated face closure. Remaining boundary caps audited separately.",
    },
  };
}

/** Keep the exterior component; triangulate only its boundary rings. */
export function closeExterior(positions, indices) {
  const faceLinks = Array.from({ length: indices.length / 3 }, () => []),
    firstFace = new Map();
  for (let t = 0; t < indices.length / 3; t++)
    for (let k = 0; k < 3; k++) {
      const a = indices[t * 3 + k],
        b = indices[t * 3 + ((k + 1) % 3)],
        key = a < b ? `${a},${b}` : `${b},${a}`;
      if (firstFace.has(key)) {
        const other = firstFace.get(key);
        faceLinks[t].push(other);
        faceLinks[other].push(t);
      } else firstFace.set(key, t);
    }
  const visited = new Uint8Array(indices.length / 3),
    components = [];
  for (let t = 0; t < visited.length; t++)
    if (!visited[t]) {
      const component = [],
        queue = [t];
      visited[t] = 1;
      for (let at = 0; at < queue.length; at++) {
        const face = queue[at];
        component.push(face);
        for (const other of faceLinks[face])
          if (!visited[other]) {
            visited[other] = 1;
            queue.push(other);
          }
      }
      components.push(component);
    }
  components.sort((a, b) => b.length - a.length);
  positions = Array.from(positions);
  const result = components[0].flatMap((t) => [
    indices[t * 3],
    indices[t * 3 + 1],
    indices[t * 3 + 2],
  ]);
  const edgeUses = new Map();
  for (let t = 0; t < result.length; t += 3)
    for (let k = 0; k < 3; k++) {
      const a = result[t + k],
        b = result[t + ((k + 1) % 3)],
        key = a < b ? `${a},${b}` : `${b},${a}`;
      const previous = edgeUses.get(key);
      if (previous) previous.count++;
      else edgeUses.set(key, { a, b, count: 1 });
    }
  const boundary = [...edgeUses.values()].filter((e) => e.count === 1),
    outgoing = new Map();
  for (const edge of boundary) {
    if (!outgoing.has(edge.a)) outgoing.set(edge.a, []);
    outgoing.get(edge.a).push(edge);
  }
  const used = new Set(),
    caps = [];
  for (const first of boundary) {
    if (used.has(first)) continue;
    const loop = [],
      edges = [];
    let edge = first;
    while (edge && !used.has(edge)) {
      used.add(edge);
      edges.push(edge);
      loop.push(edge.a);
      if (edge.b === first.a) break;
      edge = outgoing.get(edge.b)?.find((e) => !used.has(e));
    }
    if (!edges.length || edges.at(-1).b !== first.a)
      throw new Error("Exterior boundary is not a closed oriented ring");
    const simpleLoops = [],
      pending = [loop];
    while (pending.length) {
      const ring = pending.pop(),
        seen = new Map();
      let split = false;
      for (let at = 0; at < ring.length; at++) {
        if (seen.has(ring[at])) {
          const before = seen.get(ring[at]);
          pending.push(ring.slice(before, at), [...ring.slice(0, before), ...ring.slice(at)]);
          split = true;
          break;
        }
        seen.set(ring[at], at);
      }
      if (!split && ring.length >= 3) simpleLoops.push(ring);
    }
    for (const loop of simpleLoops) {
      const reverse = [...loop].reverse(),
        centre = [0, 1, 2].map(
          (k) => reverse.reduce((sum, p) => sum + positions[p * 3 + k], 0) / reverse.length,
        );
      const normal = [0, 0, 0];
      for (let at = 0; at < reverse.length; at++) {
        const a = reverse[at] * 3,
          b = reverse[(at + 1) % reverse.length] * 3;
        normal[0] += (positions[a + 1] - positions[b + 1]) * (positions[a + 2] + positions[b + 2]);
        normal[1] += (positions[a + 2] - positions[b + 2]) * (positions[a] + positions[b]);
        normal[2] += (positions[a] - positions[b]) * (positions[a + 1] + positions[b + 1]);
      }
      const length = Math.hypot(...normal) || 1;
      for (let k = 0; k < 3; k++) normal[k] /= length;
      // The scan's non-planar aperture rings include near-collinear points.
      // Preserve every boundary edge with one inset-free centre fan; projected
      // ear clipping silently drops those vertices and creates topological holes.
      const centreId = positions.length / 3;
      positions.push(...centre.map((value, k) => value + normal[k] * 1e-5));
      const triangles = [];
      for (let at = 0; at < reverse.length; at++) {
        const a = reverse[at],
          b = reverse[(at + 1) % reverse.length];
        result.push(a, b, centreId);
        triangles.push([a, b, centreId]);
      }
      caps.push({
        boundaryVertices: loop.length,
        triangles: triangles.length,
        centreMetres: centre,
        maxRadiusMetres: Math.max(
          ...loop.map((p) => Math.hypot(...[0, 1, 2].map((k) => positions[p * 3 + k] - centre[k]))),
        ),
        maxPlaneDeviationMetres: Math.max(
          ...loop.map((p) =>
            Math.abs(
              [0, 1, 2].reduce((sum, k) => sum + (positions[p * 3 + k] - centre[k]) * normal[k], 0),
            ),
          ),
        ),
      });
    }
  }
  return {
    positions,
    indices: new Uint32Array(result),
    audit: {
      removedDisconnectedFragments: components.length - 1,
      removedFragmentTriangles: components.slice(1).reduce((sum, c) => sum + c.length, 0),
      caps,
    },
  };
}
