/** Surface-distance feathering: never blur tint across nearby, disconnected skin. */
export const SCULPT_SEAM_WIDTH_M = 0.012;

export function sculptSeamWeights(positions, graph, boundaryVertices, width = SCULPT_SEAM_WIDTH_M) {
  if (!Number.isFinite(width) || width < 0.001 || width > 0.03)
    throw new Error("Seam width must be finite and between 1 and 30 mm");
  if (positions.length !== graph.length) throw new Error("Inconsistent surface graph");
  const distance = new Float64Array(positions.length).fill(Infinity);
  const queue = [];
  const push = (entry) => {
    let i = queue.length;
    queue.push(entry);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (queue[parent][0] <= entry[0]) break;
      queue[i] = queue[parent];
      i = parent;
    }
    queue[i] = entry;
  };
  const pop = () => {
    const first = queue[0],
      last = queue.pop();
    if (queue.length) {
      let i = 0;
      while (i * 2 + 1 < queue.length) {
        let child = i * 2 + 1;
        if (child + 1 < queue.length && queue[child + 1][0] < queue[child][0]) child++;
        if (queue[child][0] >= last[0]) break;
        queue[i] = queue[child];
        i = child;
      }
      queue[i] = last;
    }
    return first;
  };
  for (const id of boundaryVertices) {
    if (!Number.isInteger(id) || id < 0 || id >= positions.length)
      throw new Error("Invalid boundary vertex");
    if (distance[id] === 0) continue;
    distance[id] = 0;
    push([0, id]);
  }
  while (queue.length) {
    const [current, id] = pop();
    if (current !== distance[id] || current >= width) continue;
    for (const other of graph[id]) {
      const edge = Math.hypot(...positions[id].map((value, k) => value - positions[other][k]));
      if (!Number.isFinite(edge) || edge <= 0) throw new Error("Invalid surface edge");
      const next = current + edge;
      if (next < distance[other] && next < width) {
        distance[other] = next;
        push([next, other]);
      }
    }
  }
  return Array.from(distance, (value) => {
    const t = Math.min(1, value / width);
    return t * t * (3 - 2 * t);
  });
}
