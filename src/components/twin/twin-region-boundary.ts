import { DataTexture, LinearFilter, RedFormat, Vector4, type BufferGeometry } from "three";

/** Graphic transition on the metre-scale generic mesh, not an anatomical measurement. */
export const TWIN_BACK_FEATHER_METRES = 0.025;
const SIZE = 256;
export type TwinBoundaryField = { texture: DataTexture; bounds: Vector4 };

const smooth = (low: number, high: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
};
const clampPixel = (value: number) => Math.max(0, Math.min(SIZE - 1, value));

/** Separable, bounded Gaussian smoothing of a graphic distance field. */
function blur(input: Float32Array, sigma: number, horizontal: boolean): Float32Array {
  const radius = Math.min(24, Math.max(1, Math.ceil(3 * sigma)));
  const weights: number[] = [];
  let sum = 0;
  for (let k = -radius; k <= radius; k++) {
    const weight = Math.exp(-(k * k) / (2 * sigma * sigma));
    weights.push(weight);
    sum += weight;
  }
  const result = new Float32Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      let value = 0;
      for (let k = -radius; k <= radius; k++) {
        const sample = horizontal ? y * SIZE + clampPixel(x + k) : clampPixel(y + k) * SIZE + x;
        value += input[sample]! * weights[k + radius]!;
      }
      result[y * SIZE + x] = value / sum;
    }
  return result;
}

/**
 * Only for the verified posterior Body surface: rasterize its existing
 * XY triangle footprint and smooth the signed interior distance. The
 * fragment shader samples the result, independent of coarse vertices.
 * No position, topology, normal, UV or picking mutation. One 64KiB R8
 * texture, no extra mesh/draw call and no per-frame CPU calculation.
 */
export function createTwinBoundaryField(
  geometry: BufferGeometry,
  width = TWIN_BACK_FEATHER_METRES,
): TwinBoundaryField {
  if (!Number.isFinite(width) || width < 0.001 || width > 0.1)
    throw new Error("TWIN_BOUNDARY_WIDTH_INVALID");
  const p = geometry.getAttribute("position");
  const index = geometry.getIndex();
  if (!p || p.itemSize !== 3 || p.count < 3 || p.count > 65536)
    throw new Error("TWIN_BOUNDARY_POSITIONS_INVALID");
  const count = index?.count ?? p.count;
  if (count < 3 || count % 3 !== 0 || count > 196608)
    throw new Error("TWIN_BOUNDARY_TRIANGLES_INVALID");
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i);
    if (![x, y, z].every((v) => Number.isFinite(v) && Math.abs(v) <= 10))
      throw new Error("TWIN_BOUNDARY_POSITION_INVALID");
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  if (maxX <= minX || maxY <= minY) throw new Error("TWIN_BOUNDARY_PROJECTION_EMPTY");
  minX -= width * 2;
  minY -= width * 2;
  maxX += width * 2;
  maxY += width * 2;
  const sx = (maxX - minX) / SIZE,
    sy = (maxY - minY) / SIZE;
  const inside = new Uint8Array(SIZE * SIZE);
  const edge = (a: [number, number], b: [number, number], x: number, y: number) =>
    (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
  for (let i = 0; i < count; i += 3) {
    const points = [0, 1, 2].map((corner): [number, number] => {
      const vertex = index ? index.getX(i + corner) : i + corner;
      if (!Number.isInteger(vertex) || vertex < 0 || vertex >= p.count)
        throw new Error("TWIN_BOUNDARY_INDEX_INVALID");
      return [(p.getX(vertex) - minX) / sx, (p.getY(vertex) - minY) / sy];
    });
    const a = points[0]!,
      b = points[1]!,
      c = points[2]!;
    if (Math.abs(edge(a, b, c[0], c[1])) < 1e-10) continue;
    const left = clampPixel(Math.floor(Math.min(a[0], b[0], c[0])));
    const right = clampPixel(Math.ceil(Math.max(a[0], b[0], c[0])));
    const bottom = clampPixel(Math.floor(Math.min(a[1], b[1], c[1])));
    const top = clampPixel(Math.ceil(Math.max(a[1], b[1], c[1])));
    for (let y = bottom; y <= top; y++)
      for (let x = left; x <= right; x++) {
        const u = edge(a, b, x + 0.5, y + 0.5);
        const v = edge(b, c, x + 0.5, y + 0.5);
        const w = edge(c, a, x + 0.5, y + 0.5);
        if ((u >= -1e-8 && v >= -1e-8 && w >= -1e-8) || (u <= 1e-8 && v <= 1e-8 && w <= 1e-8))
          inside[y * SIZE + x] = 1;
      }
  }
  if (!inside.some((value) => value === 1)) throw new Error("TWIN_BOUNDARY_PROJECTION_EMPTY");
  // Two-pass eight-neighbour chamfer distance, not a body measurement.
  const distance = new Float32Array(SIZE * SIZE).fill(width * 2);
  for (let y = 1; y < SIZE - 1; y++)
    for (let x = 1; x < SIZE - 1; x++) {
      const at = y * SIZE + x;
      if ([at - 1, at + 1, at - SIZE, at + SIZE].some((n) => inside[n] !== inside[at]))
        distance[at] = 0;
    }
  const diagonal = Math.hypot(sx, sy);
  for (let y = 1; y < SIZE - 1; y++)
    for (let x = 1; x < SIZE - 1; x++) {
      const at = y * SIZE + x;
      distance[at] = Math.min(
        distance[at]!,
        distance[at - 1]! + sx,
        distance[at - SIZE]! + sy,
        distance[at - SIZE - 1]! + diagonal,
        distance[at - SIZE + 1]! + diagonal,
      );
    }
  for (let y = SIZE - 2; y > 0; y--)
    for (let x = SIZE - 2; x > 0; x--) {
      const at = y * SIZE + x;
      distance[at] = Math.min(
        distance[at]!,
        distance[at + 1]! + sx,
        distance[at + SIZE]! + sy,
        distance[at + SIZE - 1]! + diagonal,
        distance[at + SIZE + 1]! + diagonal,
      );
    }
  const signed = new Float32Array(distance.length);
  for (let i = 0; i < distance.length; i++) signed[i] = inside[i] ? distance[i]! : -distance[i]!;
  const softened = blur(blur(signed, (width * 0.22) / sx, true), (width * 0.22) / sy, false);
  const bytes = new Uint8Array(SIZE * SIZE);
  for (let i = 0; i < bytes.length; i++) {
    // The second term keeps the original footprint border neutral.
    bytes[i] = inside[i]
      ? Math.round(
          255 *
            smooth(width * 0.16, width * 0.8, softened[i]!) *
            smooth(0, width * 0.12, distance[i]!),
        )
      : 0;
  }
  const texture = new DataTexture(bytes, SIZE, SIZE, RedFormat);
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.flipY = false;
  texture.needsUpdate = true;
  return { texture, bounds: new Vector4(minX, minY, maxX - minX, maxY - minY) };
}
