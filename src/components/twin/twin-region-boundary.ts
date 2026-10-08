import { Float32BufferAttribute, type BufferGeometry } from "three";

/** Presentation distance on the registered metre-scale generic body, not physiology. */
export const TWIN_BACK_FEATHER_METRES = 0.025;

/**
 * Fade a region's colour inside its existing open boundary, not its geometry.
 * Coincident vertices are joined in the working graph only (UV/normal seams are
 * not borders). Source positions, indices, normals and raycasting never change.
 * Multi-source Dijkstra is capped at the feather width, once per asset load.
 */
export function createTwinBoundaryMask(
  geometry: BufferGeometry,
  width = TWIN_BACK_FEATHER_METRES,
): Float32BufferAttribute {
  if (!Number.isFinite(width) || width <= 0 || width > 0.1)
    throw new Error("TWIN_BOUNDARY_WIDTH_INVALID");
  const positions = geometry.getAttribute("position");
  const index = geometry.getIndex();
  if (!positions || positions.itemSize !== 3 || positions.count < 3 || positions.count > 65536)
    throw new Error("TWIN_BOUNDARY_POSITIONS_INVALID");
  const count = index?.count ?? positions.count;
  if (count % 3 !== 0 || count > 196608) throw new Error("TWIN_BOUNDARY_TRIANGLES_INVALID");

  const unique = new Map<string, number>();
  const vertexOf: number[] = [];
  const points: Array<[number, number, number]> = [];
  for (let i = 0; i < positions.count; i++) {
    const point: [number, number, number] = [
      positions.getX(i),
      positions.getY(i),
      positions.getZ(i),
    ];
    if (!point.every(Number.isFinite)) throw new Error("TWIN_BOUNDARY_POSITION_NONFINITE");
    // Exact positions only: nearby, disconnected surfaces must not be welded.
    const key = point.join(",");
    let vertex = unique.get(key);
    if (vertex === undefined) {
      vertex = points.length;
      unique.set(key, vertex);
      points.push(point);
    }
    vertexOf.push(vertex);
  }
  const edges = new Map<string, { a: number; b: number; count: number }>();
  const adjacency: Array<Map<number, number>> = points.map(() => new Map());
  for (let i = 0; i < count; i += 3) {
    const triangle = [0, 1, 2].map((corner) => {
      const source = index ? index.getX(i + corner) : i + corner;
      if (!Number.isInteger(source) || source < 0 || source >= positions.count)
        throw new Error("TWIN_BOUNDARY_INDEX_INVALID");
      return vertexOf[source]!;
    });
    if (new Set(triangle).size !== 3) throw new Error("TWIN_BOUNDARY_DEGENERATE_TRIANGLE");
    for (let corner = 0; corner < 3; corner++) {
      const a = triangle[corner]!;
      const b = triangle[(corner + 1) % 3]!;
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      const previous = edges.get(key);
      if (previous) {
        previous.count++;
        if (previous.count > 2) throw new Error("TWIN_BOUNDARY_NONMANIFOLD");
      } else {
        edges.set(key, { a, b, count: 1 });
        const pa = points[a]!;
        const pb = points[b]!;
        const distance = Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]);
        if (!Number.isFinite(distance) || distance === 0)
          throw new Error("TWIN_BOUNDARY_EDGE_INVALID");
        adjacency[a]!.set(b, distance);
        adjacency[b]!.set(a, distance);
      }
    }
  }

  // Small binary heap, ordered by distance. Each relaxation is O(log V).
  const heap: Array<{ vertex: number; distance: number }> = [];
  const push = (entry: { vertex: number; distance: number }) => {
    heap.push(entry);
    let at = heap.length - 1;
    while (at > 0) {
      const parent = Math.floor((at - 1) / 2);
      if (heap[parent]!.distance <= entry.distance) break;
      heap[at] = heap[parent]!;
      at = parent;
    }
    heap[at] = entry;
  };
  const pop = () => {
    const first = heap[0]!;
    const last = heap.pop()!;
    if (heap.length) {
      let at = 0;
      while (at * 2 + 1 < heap.length) {
        let child = at * 2 + 1;
        if (child + 1 < heap.length && heap[child + 1]!.distance < heap[child]!.distance) child++;
        if (last.distance <= heap[child]!.distance) break;
        heap[at] = heap[child]!;
        at = child;
      }
      heap[at] = last;
    }
    return first;
  };
  const distance = new Float64Array(points.length).fill(width);
  for (const edge of edges.values()) {
    if (edge.count !== 1) continue;
    for (const vertex of [edge.a, edge.b]) {
      if (distance[vertex] === 0) continue;
      distance[vertex] = 0;
      push({ vertex, distance: 0 });
    }
  }
  while (heap.length) {
    const entry = pop();
    if (entry.distance !== distance[entry.vertex]) continue;
    for (const [neighbor, length] of adjacency[entry.vertex]!) {
      const next = entry.distance + length;
      if (next >= distance[neighbor]!) continue;
      distance[neighbor] = next;
      push({ vertex: neighbor, distance: next });
    }
  }
  return new Float32BufferAttribute(
    vertexOf.map((vertex) => {
      const t = Math.min(1, Math.max(0, distance[vertex]! / width));
      return t * t * (3 - 2 * t);
    }),
    1,
  );
}
