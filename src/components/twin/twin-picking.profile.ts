import { Matrix4, Mesh, Vector3, type Object3D } from "three";

/** Graphic cross-sections, never anatomical or physiological measurements. */
const SLICE_COUNT = 129;

function finite(point: Vector3): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z);
}

/**
 * The torso centre plane can sit in front of a visible calf. Derive the
 * near-side axis at the hit's actual height from existing triangles. Build
 * once per loaded body, never per animation frame. Does not mutate geometry,
 * materials, region identifiers or user data.
 */
export function createTwinPickingProfile(body: Object3D) {
  body.updateWorldMatrix(true, true);
  if (
    !body.matrixWorld.elements.every(Number.isFinite) ||
    Math.abs(body.matrixWorld.determinant()) < 1e-12
  )
    return null;
  const inverse = body.matrixWorld.clone().invert();
  const surfaces: Array<{ mesh: Mesh; relative: Matrix4 }> = [];
  body.traverse((object) => {
    if (object instanceof Mesh && object.geometry.getAttribute("position")?.itemSize === 3)
      surfaces.push({
        mesh: object,
        relative: new Matrix4().multiplyMatrices(inverse, object.matrixWorld),
      });
  });
  const point = new Vector3();
  let floor = Infinity;
  let ceiling = -Infinity;
  for (const { mesh, relative } of surfaces) {
    const position = mesh.geometry.getAttribute("position");
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i).applyMatrix4(relative);
      if (!finite(point)) return null;
      floor = Math.min(floor, point.y);
      ceiling = Math.max(ceiling, point.y);
    }
  }
  if (!Number.isFinite(floor) || !Number.isFinite(ceiling) || ceiling - floor <= 1e-9) return null;
  const step = (ceiling - floor) / (SLICE_COUNT - 1);
  const slices = Array.from({ length: SLICE_COUNT }, (_, row) => ({
    y: floor + row * step,
    minX: Infinity,
    maxX: -Infinity,
    minZ: Infinity,
    maxZ: -Infinity,
  }));
  type Slice = (typeof slices)[number];
  const include = (slice: Slice, x: number, z: number) => {
    slice.minX = Math.min(slice.minX, x);
    slice.maxX = Math.max(slice.maxX, x);
    slice.minZ = Math.min(slice.minZ, z);
    slice.maxZ = Math.max(slice.maxZ, z);
  };
  const edge = (slice: Slice, left: Vector3, right: Vector3) => {
    const dy = right.y - left.y;
    if (dy === 0) {
      if (Math.abs(slice.y - left.y) <= step * 1e-8) {
        include(slice, left.x, left.z);
        include(slice, right.x, right.z);
      }
      return;
    }
    const fraction = (slice.y - left.y) / dy;
    if (fraction < 0 || fraction > 1) return;
    include(slice, left.x + (right.x - left.x) * fraction, left.z + (right.z - left.z) * fraction);
  };
  const a = new Vector3(),
    b = new Vector3(),
    c = new Vector3();
  for (const { mesh, relative } of surfaces) {
    const position = mesh.geometry.getAttribute("position");
    const index = mesh.geometry.getIndex();
    const count = index?.count ?? position.count;
    if (count % 3 !== 0) return null;
    for (let i = 0; i + 2 < count; i += 3) {
      a.fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(relative);
      b.fromBufferAttribute(position, index ? index.getX(i + 1) : i + 1).applyMatrix4(relative);
      c.fromBufferAttribute(position, index ? index.getX(i + 2) : i + 2).applyMatrix4(relative);
      if (!finite(a) || !finite(b) || !finite(c)) return null;
      const start = Math.max(0, Math.ceil((Math.min(a.y, b.y, c.y) - floor) / step));
      const end = Math.min(SLICE_COUNT - 1, Math.floor((Math.max(a.y, b.y, c.y) - floor) / step));
      for (let row = start; row <= end; row++) {
        const slice = slices[row];
        if (!slice) continue;
        edge(slice, a, b);
        edge(slice, b, c);
        edge(slice, c, a);
      }
    }
  }
  const valid = slices
    .filter(
      (slice) =>
        Number.isFinite(slice.minX) &&
        Number.isFinite(slice.maxX) &&
        Number.isFinite(slice.minZ) &&
        Number.isFinite(slice.maxZ),
    )
    .map((slice) => ({
      y: slice.y,
      x: (slice.minX + slice.maxX) / 2,
      z: (slice.minZ + slice.maxZ) / 2,
    }));
  const first = valid[0],
    last = valid.at(-1);
  if (!first || !last || valid.length < 2) return null;
  const local = new Vector3();
  return {
    /** Reuses caller storage and follows later transforms, including micro-sway. */
    axisAt(worldPoint: Vector3, out: Vector3): boolean {
      if (!finite(worldPoint)) return false;
      body.updateWorldMatrix(true, false);
      if (
        !body.matrixWorld.elements.every(Number.isFinite) ||
        Math.abs(body.matrixWorld.determinant()) < 1e-12
      )
        return false;
      body.worldToLocal(local.copy(worldPoint));
      if (!finite(local)) return false;
      const y = Math.max(first.y, Math.min(last.y, local.y));
      let lower = first,
        upper = last;
      for (const slice of valid) {
        if (slice.y >= y) {
          upper = slice;
          break;
        }
        lower = slice;
      }
      const weight = upper.y === lower.y ? 0 : (y - lower.y) / (upper.y - lower.y);
      out
        .set(
          lower.x + (upper.x - lower.x) * weight,
          local.y,
          lower.z + (upper.z - lower.z) * weight,
        )
        .applyMatrix4(body.matrixWorld);
      return finite(out);
    },
  };
}
