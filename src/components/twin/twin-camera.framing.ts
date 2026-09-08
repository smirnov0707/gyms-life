import { Box3, Mesh, Vector3, type Object3D } from "three";
import { TWIN_CAMERA, TWIN_FIELD_OF_VIEW, TWIN_FRAME } from "./twin-scene.model";

/** Fit the loaded geometry, not the height of a different asset. No rescaling. */
export function createTwinCameraFrame(body: Object3D) {
  body.updateWorldMatrix(true, true);
  const bounds = new Box3().setFromObject(body, true);
  const height = bounds.max.y - bounds.min.y;
  if (bounds.isEmpty() || !Number.isFinite(height) || height <= 0) {
    throw new Error("Cannot frame an empty or invalid Twin body");
  }
  const target = bounds.getCenter(new Vector3());
  target.y = bounds.min.y + height * (TWIN_FRAME.eyeHeight / TWIN_FRAME.height);
  const profile: Array<{ y: number; radius: number }> = [];
  const point = new Vector3();
  body.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const positions = object.geometry.getAttribute("position");
    if (!positions) return;
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld).sub(target);
      if (![point.x, point.y, point.z].every(Number.isFinite)) {
        throw new Error("Cannot frame non-finite Twin coordinates");
      }
      profile.push({ y: point.y, radius: Math.hypot(point.x, point.z) });
    }
  });
  if (!profile.length) throw new Error("Twin body has no frameable vertices");
  return {
    target,
    height,
    fitDistance(aspect: number) {
      const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 0.7;
      const vertical = Math.tan((TWIN_FIELD_OF_VIEW * Math.PI) / 360) / TWIN_FRAME.padding;
      const horizontal = vertical * safeAspect;
      let distance = 0;
      // Cover both the initial level view and Reset, at every horizontal yaw.
      // For one vertex, yaw sweeps a circle of its own radius (not a cylinder
      // as wide as the hands at head height). Solve both frustum inequalities,
      // including depth and pitch, rather than fitting a flat height rectangle.
      for (const pitch of [Math.PI / 2, TWIN_CAMERA.defaultPitch]) {
        const sin = Math.sin(pitch);
        const cos = Math.cos(pitch);
        for (const { y, radius } of profile) {
          const verticalFit = Math.max(
            radius * sin + Math.abs(y * sin - radius * cos) / vertical,
            -radius * sin + Math.abs(y * sin + radius * cos) / vertical,
          );
          const horizontalFit = radius * Math.hypot(sin, 1 / horizontal);
          distance = Math.max(distance, y * cos + verticalFit, y * cos + horizontalFit);
        }
      }
      return distance;
    },
  };
}
