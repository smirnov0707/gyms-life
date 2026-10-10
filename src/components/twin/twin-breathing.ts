import { Box3, Float32BufferAttribute, Matrix3, Mesh, Object3D, Vector3 } from "three";

const smooth = (a: number, b: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Decorative resting breath. No measurements, rate inference or whole-body scaling. */
export function twinBreathOffset(point: Vector3, bounds: Box3): Vector3 {
  const height = bounds.max.y - bounds.min.y;
  const x = point.x - (bounds.min.x + bounds.max.x) / 2;
  const y = (point.y - bounds.min.y) / height;
  const centre = 1 - smooth(0.085, 0.13, Math.abs(x) / height);
  const rib = smooth(0.64, 0.72, y) * (1 - smooth(0.79, 0.86, y));
  const abdomen = smooth(0.51, 0.61, y) * (1 - smooth(0.67, 0.74, y));
  const front = smooth(-0.025, 0.07, point.z / height);
  return new Vector3(
    x * 0.008 * rib * centre,
    height * 0.00025 * rib * centre,
    height * 0.0015 * (rib + 0.35 * abdomen * (1 - rib)) * centre * front,
  );
}

/** GPU morphs also drive Three's getVertexPosition/raycast: visual and hit surface stay together. */
export function createTwinBreathing(body: Object3D) {
  body.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(body);
  const meshes: Mesh[] = [];
  body.traverse((object) => {
    if (!(object instanceof Mesh) || "isSkinnedMesh" in object) return;
    const geometry = object.geometry;
    if (Object.keys(geometry.morphAttributes).length) return; // Never replace authored identity motion.
    const position = geometry.getAttribute("position");
    const normal = geometry.getAttribute("normal");
    if (!position || !normal) return;
    const inverse = object.matrixWorld.clone().invert();
    const worldNormal = new Matrix3().getNormalMatrix(object.matrixWorld);
    const localNormal = new Matrix3().getNormalMatrix(inverse);
    const positions = new Float32Array(position.count * 3);
    const normals = new Float32Array(position.count * 3);
    const point = new Vector3(),
      direction = new Vector3();
    const epsilon = 0.0001;
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld);
      const offset = twinBreathOffset(point, bounds);
      point
        .clone()
        .add(offset)
        .applyMatrix4(inverse)
        .sub(new Vector3().fromBufferAttribute(position, i))
        .toArray(positions, i * 3);
      // Inverse-transpose Jacobian gives a smooth normal at full inhalation.
      const columns = [0, 1, 2].map((axis) => {
        const a = point.clone(),
          b = point.clone();
        a.setComponent(axis, a.getComponent(axis) + epsilon);
        b.setComponent(axis, b.getComponent(axis) - epsilon);
        const derivative = twinBreathOffset(a, bounds)
          .sub(twinBreathOffset(b, bounds))
          .divideScalar(2 * epsilon);
        derivative.setComponent(axis, derivative.getComponent(axis) + 1);
        return derivative;
      });
      const jacobian = new Matrix3()
        .set(
          columns[0]!.x,
          columns[1]!.x,
          columns[2]!.x,
          columns[0]!.y,
          columns[1]!.y,
          columns[2]!.y,
          columns[0]!.z,
          columns[1]!.z,
          columns[2]!.z,
        )
        .invert()
        .transpose();
      direction
        .fromBufferAttribute(normal, i)
        .applyNormalMatrix(worldNormal)
        .applyNormalMatrix(jacobian)
        .applyNormalMatrix(localNormal)
        .sub(new Vector3().fromBufferAttribute(normal, i))
        .toArray(normals, i * 3);
    }
    geometry.morphTargetsRelative = true;
    geometry.morphAttributes.position = [new Float32BufferAttribute(positions, 3)];
    geometry.morphAttributes.normal = [new Float32BufferAttribute(normals, 3)];
    object.updateMorphTargets();
    // Bounds include the morph, so small movement cannot be culled or missed by a ray.
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    meshes.push(object);
  });
  return {
    setPhase(phase: number) {
      for (const mesh of meshes)
        if (mesh.morphTargetInfluences) mesh.morphTargetInfluences[0] = phase;
    },
  };
}
