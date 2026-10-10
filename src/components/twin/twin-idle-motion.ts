import { BufferGeometry, Float32BufferAttribute, Matrix3, Mesh, Object3D, Vector3 } from "three";
import blinkData from "./twin-blink-data.json";

const smooth = (a: number, b: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
type Motion = "stance" | "head" | "arms";

/** Decorative movements fitted only to the verified natural skin asset, in metres. */
export function twinIdleOffset(point: Vector3, motion: Motion): Vector3 {
  const { x, y, z } = point;
  if (motion === "stance") {
    const weight = smooth(0.14, 0.95, y);
    return new Vector3(0.018 * weight - 0.006 * smooth(1.2, 1.8, y), 0, 0);
  }
  if (motion === "head") {
    const weight = smooth(1.48, 1.61, y) * (1 - smooth(0.12, 0.19, Math.abs(x)));
    const yaw = 0.085,
      nod = 0.025;
    const dx = Math.cos(yaw) * x + Math.sin(yaw) * (z - 0.04) - x;
    const dz = -Math.sin(yaw) * x + Math.cos(yaw) * (z - 0.04) - (z - 0.04);
    return new Vector3(
      dx,
      -Math.sin(nod) * (z - 0.04),
      dz + Math.sin(nod) * (y - 1.57),
    ).multiplyScalar(weight);
  }
  const arm = smooth(0.17, 0.265, Math.abs(x)) * smooth(0.7, 0.8, y) * (1 - smooth(1.43, 1.54, y));
  const side = Math.sign(x);
  return new Vector3(side * (1.48 - y) * 0.018, 0.0015, side * (1.48 - y) * 0.025).multiplyScalar(
    arm,
  );
}

/** Uneven intervals, including one double blink, with a fast close and slower release. */
export function twinBlinkPhase(milliseconds: number): number {
  if (!Number.isFinite(milliseconds)) return 0;
  const time = ((milliseconds % 31000) + 31000) % 31000;
  for (const start of [2600, 7100, 11200, 11600, 17400, 23300, 28600]) {
    const elapsed = time - start;
    if (elapsed >= 0 && elapsed < 90) return smooth(0, 90, elapsed);
    if (elapsed >= 90 && elapsed < 130) return 1;
    if (elapsed >= 130 && elapsed < 290) return 1 - smooth(130, 290, elapsed);
  }
  return 0;
}

/** Append GPU morphs; Three's vertex access and raycasting use the same deformed surface. */
export function createTwinIdleMotion(body: Object3D) {
  const meshes: { mesh: Mesh; start: number }[] = [];
  let weights = [0, 0, 0, 0];
  body.updateMatrixWorld(true);
  body.traverse((object) => {
    if (!(object instanceof Mesh) || "isSkinnedMesh" in object) return;
    const geometry = object.geometry;
    // The caller installs our single breathing target first. Do not overwrite a rig.
    if (!geometry.morphTargetsRelative || geometry.morphAttributes.position?.length !== 1) return;
    const position = geometry.getAttribute("position"),
      normal = geometry.getAttribute("normal");
    if (!position || !normal) return;
    const inverse = object.matrixWorld.clone().invert();
    const worldNormal = new Matrix3().getNormalMatrix(object.matrixWorld);
    const localNormal = new Matrix3().getNormalMatrix(inverse);
    const start = geometry.morphAttributes.position.length;
    for (const motion of ["stance", "head", "arms"] as const) {
      const positions = new Float32Array(position.count * 3),
        normals = new Float32Array(position.count * 3);
      for (let i = 0; i < position.count; i++) {
        const local = new Vector3().fromBufferAttribute(position, i);
        const point = local.clone().applyMatrix4(object.matrixWorld);
        point
          .clone()
          .add(twinIdleOffset(point, motion))
          .applyMatrix4(inverse)
          .sub(local)
          .toArray(positions, i * 3);
        const epsilon = 0.0001;
        const columns = [0, 1, 2].map((axis) => {
          const a = point.clone(),
            b = point.clone();
          a.setComponent(axis, a.getComponent(axis) + epsilon);
          b.setComponent(axis, b.getComponent(axis) - epsilon);
          const derivative = twinIdleOffset(a, motion)
            .sub(twinIdleOffset(b, motion))
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
        new Vector3()
          .fromBufferAttribute(normal, i)
          .applyNormalMatrix(worldNormal)
          .applyNormalMatrix(jacobian)
          .applyNormalMatrix(localNormal)
          .sub(new Vector3().fromBufferAttribute(normal, i))
          .toArray(normals, i * 3);
      }
      geometry.morphAttributes.position.push(new Float32BufferAttribute(positions, 3));
      geometry.morphAttributes.normal!.push(new Float32BufferAttribute(normals, 3));
    }
    const blink = new Float32Array(position.count * 3);
    const blinkNormals = new Float32Array(position.count * 3);
    // Native atlas duplicates included in the exported data; eyes themselves stay round.
    if (object.userData["twinNativeBlink"] === true && position.count === 11345) {
      for (const [index, x, y, z] of blinkData) blink.set([x!, y!, z!], index! * 3);
      const base = new BufferGeometry().setIndex(geometry.index).setAttribute("position", position);
      base.computeVertexNormals();
      const closedPositions = new Float32Array(position.count * 3);
      for (let i = 0; i < position.count * 3; i++)
        closedPositions[i] = position.array[i]! + blink[i]!;
      const closed = new BufferGeometry()
        .setIndex(geometry.index)
        .setAttribute("position", new Float32BufferAttribute(closedPositions, 3));
      closed.computeVertexNormals();
      for (let i = 0; i < blinkNormals.length; i++)
        blinkNormals[i] =
          closed.getAttribute("normal").array[i]! - base.getAttribute("normal").array[i]!;
      base.dispose();
      closed.dispose();
    }
    geometry.morphAttributes.position.push(new Float32BufferAttribute(blink, 3));
    geometry.morphAttributes.normal!.push(new Float32BufferAttribute(blinkNormals, 3));
    object.updateMorphTargets();
    // Cover simultaneous positive/negative stance, head and arm weights, not just one target.
    geometry.computeBoundingBox();
    geometry.boundingBox!.expandByScalar(0.055);
    geometry.computeBoundingSphere();
    geometry.boundingSphere!.radius += 0.055;
    meshes.push({ mesh: object, start });
  });
  return {
    setTime(milliseconds: number, enabled: boolean) {
      const t = Number.isFinite(milliseconds) ? milliseconds / 1000 : 0;
      weights = enabled
        ? [
            0.75 * Math.sin((t * 2 * Math.PI) / 11) + 0.25 * Math.sin((t * 2 * Math.PI) / 17),
            Math.sin((t * 2 * Math.PI) / 13) * 0.8 + Math.sin((t * 2 * Math.PI) / 7) * 0.2,
            Math.sin((t * 2 * Math.PI) / 8.7),
            twinBlinkPhase(milliseconds),
          ]
        : [0, 0, 0, 0];
      for (const { mesh, start } of meshes)
        if (mesh.morphTargetInfluences)
          weights.forEach((value, i) => {
            mesh.morphTargetInfluences![start + i] = value;
          });
      return { stance: weights[0]!, blink: weights[3]! };
    },
    moveAxis(point: Vector3) {
      const base = point.clone();
      for (const [index, motion] of (["stance", "head", "arms"] as const).entries())
        point.addScaledVector(twinIdleOffset(base, motion), weights[index]!);
    },
  };
}
