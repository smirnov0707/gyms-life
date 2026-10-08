import { createTwinAnatomyMaterial } from "./twin-anatomy.material";
import { TWIN_SKIN_MATERIAL } from "./twin-skin.palette";
import { BufferGeometry, Float32BufferAttribute, Group, Mesh } from "three";
import { isTwinBodyRegion, type TwinBodyRegion } from "./twin-scene.model";
import surface from "./twin-body.surface.json";

/**
 * Generic, locally authored body surface. Not a personal scan, body-composition
 * estimate or measured anatomy. Its broad region IDs are the same as before.
 *
 * Surface extraction and simplification happen OFFLINE. Browsers only unpack
 * the small baked mesh. Shared positions/normals keep the regional pieces
 * geometrically continuous, while independent materials preserve picking and
 * canonical region highlighting without new physiological calculations.
 */
export function createTwinBody() {
  const body = new Group();
  body.name = "generic-human-surface";
  const regionMeshes = new Map<TwinBodyRegion, Mesh[]>();
  const regionOf = new Map<Mesh, TwinBodyRegion>();
  const meshes: Mesh[] = [];
  const baseColorOf = new Map<Mesh, number>();
  const positions = new Float32BufferAttribute(
    surface.positions.map((value) => value / surface.scale),
    3,
  );
  const whole = new BufferGeometry();
  whole.setAttribute("position", positions);
  whole.setIndex(Object.values(surface.groups).flat());
  // Compute on the complete surface, not per colour region: no lighting seams.
  whole.computeVertexNormals();
  const normals = whole.getAttribute("normal");

  for (const [id, indices] of Object.entries(surface.groups)) {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", positions);
    geometry.setAttribute("normal", normals);
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    const material = createTwinAnatomyMaterial(TWIN_SKIN_MATERIAL);
    const mesh = new Mesh(geometry, material);
    mesh.name = `twin-region-${id}`;
    body.add(mesh);
    meshes.push(mesh);
    baseColorOf.set(mesh, TWIN_SKIN_MATERIAL.color);
    if (isTwinBodyRegion(id)) {
      regionOf.set(mesh, id);
      regionMeshes.set(id, [mesh]);
    }
  }

  let disposed = false;
  return {
    body,
    meshes,
    regionMeshes,
    regionOf,
    baseColorOf,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const mesh of meshes) {
        mesh.geometry.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
        else material.dispose();
      }
      whole.dispose();
      baseColorOf.clear();
      regionOf.clear();
      regionMeshes.clear();
      body.clear();
    },
  };
}
