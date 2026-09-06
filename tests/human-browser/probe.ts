import { Raycaster, Vector3 } from "three";
import { loadHumanBody } from "../../src/components/twin/human-body.loader";
import type { HumanAssetDescriptor } from "../../src/components/twin/human-asset.policy";

/** Test-only real-geometry inspection. Never included in a product route. */
export async function inspectHumanCandidate(descriptor: HumanAssetDescriptor) {
  const model = await loadHumanBody(descriptor, new AbortController().signal);
  try {
    const samples = [
      { name: "front", y: 1.41, z: 3, dz: -1 },
      { name: "back", y: 1.41, z: -3, dz: 1 },
      { name: "head", y: 1.73, z: 3, dz: -1 },
    ];
    model.body.updateMatrixWorld(true);
    return {
      groups: [...model.regionMeshes.keys()],
      metrics: model.metrics,
      rays: samples.map(({ name, y, z, dz }) => {
        const first = new Raycaster(new Vector3(0, y, z), new Vector3(0, 0, dz))
          .intersectObjects(model.meshes, false)[0];
        return { name, region: first ? model.regionOf.get(first.object as typeof model.meshes[number]) ?? "neutral" : "none" };
      }),
    };
  } finally { model.dispose(); }
}
