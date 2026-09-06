import {
  Box3,
  Group,
  Material,
  Mesh,
  MeshPhysicalMaterial,
  Object3D,
  SRGBColorSpace,
  Texture,
  Vector3,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  DEFAULT_TWIN_HUMAN_ASSET,
  TwinHumanAssetSchema,
  type TwinHumanAsset,
} from "./twin-human-renderer.schema";

export type TwinHumanSurface = {
  root: Group;
  meshes: Mesh[];
  dispose: () => void;
};

function collectTextures(material: Material): Texture[] {
  const textures = new Set<Texture>();
  for (const value of Object.values(material)) {
    if (value instanceof Texture) textures.add(value);
  }
  return [...textures];
}

function prepareHumanMaterial(material: Material): Material {
  const cloned = material.clone();
  const candidate = cloned as MeshPhysicalMaterial;
  if ("roughness" in candidate) candidate.roughness = Math.max(0.36, candidate.roughness ?? 0.48);
  if ("metalness" in candidate) candidate.metalness = Math.min(0.06, candidate.metalness ?? 0);
  if ("map" in candidate && candidate.map) candidate.map.colorSpace = SRGBColorSpace;
  cloned.needsUpdate = true;
  return cloned;
}

function normalizeHumanRoot(root: Object3D, asset: TwinHumanAsset): Group {
  const wrapper = new Group();
  wrapper.name = "photoreal-human-surface";
  wrapper.add(root);
  wrapper.position.set(...asset.position);
  wrapper.rotation.set(...asset.rotation);
  wrapper.scale.setScalar(asset.scale);

  root.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(root);
  if (!bounds.isEmpty()) {
    const size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());
    // Canonical Twin body is ~1.9 scene units tall with feet close to y=0.
    const canonicalHeight = 1.9;
    const fit = size.y > 0 ? canonicalHeight / size.y : 1;
    root.scale.multiplyScalar(fit);
    root.position.x -= center.x * fit;
    root.position.z -= center.z * fit;
    root.position.y -= bounds.min.y * fit;
  }
  return wrapper;
}

/**
 * Loads a visual-only digital human. Failure resolves to null so the canonical
 * schematic Twin remains a safe fallback and all analytical interaction stays available.
 */
export async function loadTwinHumanSurface(
  assetInput: TwinHumanAsset = DEFAULT_TWIN_HUMAN_ASSET,
): Promise<TwinHumanSurface | null> {
  const asset = TwinHumanAssetSchema.parse(assetInput);
  try {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(asset.url);
    const root = normalizeHumanRoot(gltf.scene, asset);
    const meshes: Mesh[] = [];
    const materials = new Set<Material>();
    const textures = new Set<Texture>();

    root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      meshes.push(object);
      object.castShadow = false;
      object.receiveShadow = false;
      const current = Array.isArray(object.material) ? object.material : [object.material];
      const next = current.map((material) => {
        const prepared = prepareHumanMaterial(material);
        materials.add(prepared);
        for (const texture of collectTextures(prepared)) textures.add(texture);
        return prepared;
      });
      object.material = Array.isArray(object.material) ? next : next[0];
    });

    if (meshes.length === 0) {
      root.clear();
      return null;
    }

    let disposed = false;
    return {
      root,
      meshes,
      dispose() {
        if (disposed) return;
        disposed = true;
        root.traverse((object) => {
          if (object instanceof Mesh) object.geometry.dispose();
        });
        for (const material of materials) material.dispose();
        for (const texture of textures) texture.dispose();
        root.clear();
      },
    };
  } catch {
    return null;
  }
}
