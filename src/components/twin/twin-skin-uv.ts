import type { BufferGeometry } from "three";

const fitted = new WeakSet<BufferGeometry>();
const smooth = (a: number, b: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Fit the native skin atlas to the registered, refined generic chest.
 * Its two painted landmarks sat at y≈1.331m, below the pectoral surface.
 * This local, monotonic UV warp raises them to y≈1.38m without moving any
 * geometry, region masks or breathing/picking coordinates. Eyes use another
 * atlas and must never pass through this correction.
 */
export function fitTwinChestTexture(geometry: BufferGeometry): void {
  if (fitted.has(geometry)) return;
  const uv = geometry.getAttribute("uv");
  if (!uv) return;
  fitted.add(geometry);
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    // One continuous chest patch avoids a narrow gradient between the two
    // landmarks that could invert the atlas's very thin midline triangles.
    const across = smooth(0.24, 0.3, u) * (1 - smooth(0.46, 0.52, u));
    const along = smooth(0.19, 0.245, v) * (1 - smooth(0.31, 0.39, v));
    uv.setY(i, v + 0.034 * across * along);
  }
  uv.needsUpdate = true;
}
