import {
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  SplineCurve,
  Vector2,
  Vector3,
} from "three";
import type { TwinBodyRegion } from "./twin-scene.model";

/**
 * Locally authored, generic studio mannequin. NOT a body scan, body-composition
 * estimate, personalised anatomy or left/right physiological measurement.
 * Both sides of a group always share the same source region.
 */
export function createTwinBody() {
  const body = new Group();
  const regionMeshes = new Map<TwinBodyRegion, Mesh[]>();
  const regionOf = new Map<Mesh, TwinBodyRegion>();
  const meshes: Mesh[] = [];
  const materials: MeshStandardMaterial[] = [];

  function material() {
    const result = new MeshStandardMaterial({ color: "#657076", roughness: 0.48, metalness: 0.26 });
    materials.push(result);
    return result;
  }
  function register(mesh: Mesh, region?: TwinBodyRegion) {
    body.add(mesh);
    meshes.push(mesh);
    if (region) {
      mesh.name = `twin-region-${region}`;
      regionOf.set(mesh, region);
      regionMeshes.set(region, [...(regionMeshes.get(region) ?? []), mesh]);
    }
    return mesh;
  }
  function oval(
    position: [number, number, number],
    scale: [number, number, number],
    region?: TwinBodyRegion,
    roll = 0,
  ) {
    const mesh = new Mesh(new SphereGeometry(1, 24, 16), material());
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.rotation.z = roll;
    return register(mesh, region);
  }
  function limb(
    from: [number, number, number],
    to: [number, number, number],
    radius: number,
    region?: TwinBodyRegion,
  ) {
    const a = new Vector3(...from);
    const b = new Vector3(...to);
    const length = a.distanceTo(b);
    const profile = [
      [0, 0],
      [0.025, 0.62],
      [0.15, 0.88],
      [0.34, 1],
      [0.57, 0.93],
      [0.81, 0.7],
      [0.98, 0.53],
      [1, 0],
    ];
    const geometry = new LatheGeometry(
      profile.map(([h, r]) => new Vector2((r ?? 0) * radius, (h ?? 0) * length)),
      24,
    );
    const mesh = new Mesh(geometry, material());
    mesh.position.copy(a);
    mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), b.sub(a).normalize());
    return register(mesh, region);
  }

  // Closed, elliptical trunk: shoulder girdle, ribcage, waist, pelvis.
  const trunk = new LatheGeometry(
    new SplineCurve([
      new Vector2(0, 0.84),
      new Vector2(0.125, 0.86),
      new Vector2(0.166, 0.96),
      new Vector2(0.137, 1.08),
      new Vector2(0.165, 1.22),
      new Vector2(0.205, 1.37),
      new Vector2(0.22, 1.44),
      new Vector2(0.18, 1.49),
      new Vector2(0.058, 1.53),
      new Vector2(0, 1.54),
    ]).getPoints(64),
    40,
  );
  const torso = new Mesh(trunk, material());
  torso.scale.z = 0.59;
  register(torso);
  oval([0, 1.574, 0], [0.052, 0.096, 0.058]);
  oval([0, 1.741, 0], [0.083, 0.119, 0.087]);
  oval([0, 1.687, 0.009], [0.062, 0.052, 0.061]);
  // A subdued facial plane, not a face reconstructed from the user.
  oval([0, 1.728, 0.08], [0.009, 0.02, 0.012]);

  for (const side of [-1, 1]) {
    oval([side * 0.103, 1.363, 0.084], [0.112, 0.08, 0.038], "chest", side * -0.12);
    oval([side * 0.105, 1.306, -0.092], [0.104, 0.173, 0.047], "back", side * -0.13);
    oval([side * 0.137, 1.117, 0.027], [0.035, 0.119, 0.075], "core", side * -0.13);
    oval([side * 0.085, 0.891, -0.062], [0.09, 0.101, 0.075], "glutes");
    oval([side * 0.237, 1.438, 0], [0.075, 0.087, 0.081], "shoulders", side * 0.18);
    limb([side * 0.261, 1.413, 0], [side * 0.346, 1.121, 0.006], 0.064, "arms");
    oval([side * 0.345, 1.114, 0.006], [0.037, 0.043, 0.041], "arms");
    limb([side * 0.347, 1.1, 0.007], [side * 0.398, 0.852, 0.025], 0.043, "arms");
    oval([side * 0.405, 0.804, 0.029], [0.032, 0.061, 0.021], "arms", side * 0.08);
    for (let finger = 0; finger < 4; finger++) {
      const x = side * (0.387 + finger * 0.012);
      limb(
        [x, 0.778, 0.031],
        [x + side * 0.008, 0.725 + Math.abs(finger - 1.3) * 0.01, 0.033],
        0.006,
        "arms",
      );
    }
    limb([side * 0.38, 0.825, 0.025], [side * 0.357, 0.777, 0.037], 0.01, "arms");
    limb([side * 0.087, 0.987, 0], [side * 0.11, 0.529, 0.009], 0.093, "legs");
    oval([side * 0.11, 0.518, 0.017], [0.049, 0.053, 0.05], "legs");
    limb([side * 0.11, 0.5, 0.009], [side * 0.112, 0.13, -0.008], 0.054, "legs");
    oval([side * 0.112, 0.083, 0.045], [0.046, 0.054, 0.108], "legs");
  }
  // Abs and core remain separate because the catalogue currently separates them.
  for (const y of [1.234, 1.16, 1.087]) {
    for (const side of [-1, 1]) oval([side * 0.039, y, 0.089], [0.037, 0.038, 0.021], "abs");
  }

  return {
    body,
    meshes,
    regionMeshes,
    regionOf,
    dispose() {
      meshes.forEach((mesh) => mesh.geometry.dispose());
      materials.forEach((entry) => entry.dispose());
      body.clear();
    },
  };
}
