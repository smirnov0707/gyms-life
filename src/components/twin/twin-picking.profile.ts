import { Matrix4, Mesh, Vector3, type Object3D } from "three";

/** Graphic cross-sections, never anatomical/physiological measurements. */
const SLICE_COUNT = 129;

/**
 * A torso's centre plane can sit in front of a visible calf. Derive the near-
 * side axis at the hit's actual height instead of extending that plane through
 * the entire body. Built once from existing triangles, not during animation.
 * No geometry, materials, region IDs or user data are changed.
 */
export function createTwinPickingProfile(body: Object3D) {
  body.updateWorldMatrix(true, true);
  if (!body.matrixWorld.elements.every(Number.isFinite) || Math.abs(body.matrixWorld.determinant()) < 1e-12)
    return null;
  const inverse = body.matrixWorld.clone().invert();
  const surfaces: Array<{
    mesh: Mesh;
    relative: Matrix4;
  }> = [];
  body.traverse((object) => {
    if (object instanceof Mesh && object.geometry.getAttribute("position")?.itemSize === 3)
      surfaces.push({ mesh: object, relative: new Matrix4().multiplyMatrices(inverse, object.matrixWorld) });
  });
  const point = new Vector3();
  let floor = Infinity;
  let ceiling = -Infinity;
  for (const { mesh, relative } of surfaces) {
    const position = mesh.geometry.getAttribute("position");
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i).applyMatrix4(relative);
      if (![point.x, point.y, point.z].every(Number.isFinite)) return null;
      floor = Math.min(floor, point.y);
      ceiling = Math.max(ceiling, point.y);
    }
  }
  if (!Number.isFinite(floor) || !Number.isFinite(ceiling) || ceiling - floor <= 1e-9)
    return null;
  const step = (ceiling - floor) / (SLICE_COUNT - 1);
  const minX = new Float64Array(SLICE_COUNT).fill(Infinity);
  const maxX = new Float64Array(SLICE_COUNT).fill(-Infinity);
  const minZ = new Float64Array(SLICE_COUNT).fill(Infinity);
  const maxZ = new Float64Array(SLICE_COUNT).fill(-Infinity);
  const include = (row: number, x: number, z: number) => {
    minX[row] = Math.min(minX[row] ?? Infinity, x);
    maxX[row] = Math.max(maxX[row] ?? -Infinity, x);
    minZ[row] = Math.min(minZ[row] ?? Infinity, z);
    maxZ[row] = Math.max(maxZ[row] ?? -Infinity, z);
  };
  const a = new Vector3(), b = new Vector3(), c = new Vector3();
  const edge = (row: number, y: number, left: Vector3, right: Vector3) => {
    const dy = right.y - left.y;
    if (dy === 0) {
      if (Math.abs(y - left.y) <= step * 1e-8) {
        include(row, left.x, left.z);
        include(row, right.x, right.z);
      }
      return;
    }
    const fraction = (y - left.y) / dy;
    if (fraction < 0 || fraction > 1) return;
    include(row, left.x + (right.x - left.x) * fraction, left.z + (right.z - left.z) * fraction);
  };
  for (const { mesh, relative } of surfaces) {
    const position = mesh.geometry.getAttribute("position");
    const index = mesh.geometry.getIndex();
    const count = index?.count ?? position.count;
    for (let i = 0; i + 2 < count; i += 3) {
      a.fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(relative);
      b.fromBufferAttribute(position, index ? index.getX(i + 1) : i + 1).applyMatrix4(relative);
      c.fromBufferAttribute(position, index ? index.getX(i + 2) : i + 2).applyMatrix4(relative);
      const start = Math.max(0, Math.ceil((Math.min(a.y, b.y, c.y) - floor) / step));
      const end = Math.min(SLICE_COUNT - 1, Math.floor((Math.max(a.y, b.y, c.y) - floor) / step));
      for (let row = start; row <= end; row++) {
        const y = floor + row * step;
        edge(row, y, a, b); edge(row, y, b, c); edge(row, y, c, a);
      }
    }
  }
  const valid = Array.from({ length: SLICE_COUNT }, (_, row) => row)
    .filter((row) => Number.isFinite(minX[row]) && Number.isFinite(minZ[row]));
  if (valid.length < 2) return null;
  const local = new Vector3();
  return {
    /** Reuse caller storage; account for later body transforms such as micro-sway. */
    axisAt(worldPoint: Vector3, out: Vector3): boolean {
      if (![worldPoint.x, worldPoint.y, worldPoint.z].every(Number.isFinite)) return false;
      body.worldToLocal(local.copy(worldPoint));
      if (![local.x, local.y, local.z].every(Number.isFinite)) return false;
      const row = Math.max(valid[0] ?? 0, Math.min(valid[valid.length - 1] ?? SLICE_COUNT - 1, (local.y - floor) / step));
      const upperIndex = valid.findIndex((candidate) => candidate >= row);
      const upper = valid[upperIndex < 0 ? valid.length - 1 : upperIndex] ?? 0;
      const lower = valid[Math.max(0, upperIndex - 1)] ?? upper;
      const weight = upper === lower ? 0 : (row - lower) / (upper - lower);
      const x0 = ((minX[lower] ?? 0) + (maxX[lower] ?? 0)) / 2;
      const z0 = ((minZ[lower] ?? 0) + (maxZ[lower] ?? 0)) / 2;
      const x1 = ((minX[upper] ?? 0) + (maxX[upper] ?? 0)) / 2;
      const z1 = ((minZ[upper] ?? 0) + (maxZ[upper] ?? 0)) / 2;
      out.set(x0 + (x1 - x0) * weight, local.y, z0 + (z1 - z0) * weight).applyMatrix4(body.matrixWorld);
      return [out.x, out.y, out.z].every(Number.isFinite);
    },
  };
}
