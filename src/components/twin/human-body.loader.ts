import {
  Box3,
  Color,
  LoadingManager,
  Mesh,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  Texture,
  type BufferGeometry,
  type Group,
  type Material,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  HUMAN_ASSET_LIMITS,
  inspectEmbeddedHumanGlb,
  readHumanAssetResponse,
  validateHumanAssetDescriptor,
  type HumanAssetDescriptor,
} from "./human-asset.policy";
import { isTwinBodyRegion, type TwinBodyRegion, type TwinSceneState } from "./twin-scene.model";

import { humanOverlayStyle } from "./human-overlay.model";

/** Each load owns its scene/resources. No global texture or skeleton disposal. */
export function disposeHumanScene(root: Group): void {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  const skeletons = new Set<Skeleton>();
  const images = new Set<ImageBitmap>();
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    geometries.add(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      materials.add(material);
      for (const value of Object.values(material))
        if (value instanceof Texture) textures.add(value);
    }
    if (node instanceof SkinnedMesh) skeletons.add(node.skeleton);
  });
  for (const texture of textures) {
    const image: unknown = texture.source.data;
    if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) images.add(image);
    texture.dispose();
  }
  for (const image of images) image.close();
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const skeleton of skeletons) skeleton.dispose();
  root.clear();
}

export async function loadHumanBody(asset: HumanAssetDescriptor, signal: AbortSignal) {
  validateHumanAssetDescriptor(asset);
  const response = await fetch(asset.url, { signal, credentials: "omit", redirect: "error" });
  const buffer = await readHumanAssetResponse(response);
  if (buffer.byteLength !== asset.byteLength) throw new Error("Human asset length mismatch");
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", buffer));
  const sha = [...digest].map((value) => value.toString(16).padStart(2, "0")).join("");
  if (sha !== asset.sha256) throw new Error("Human asset integrity mismatch");
  inspectEmbeddedHumanGlb(buffer);
  signal.throwIfAborted();
  const manager = new LoadingManager();
  let textureFailed = false;
  manager.onError = () => {
    textureFailed = true;
  };
  manager.setURLModifier((url) => {
    if (!url.startsWith("blob:")) throw new Error("Unexpected external human asset resource");
    return url;
  });
  const gltf = await new GLTFLoader(manager).parseAsync(buffer, "");
  const body = gltf.scene;
  try {
    signal.throwIfAborted();
    if (textureFailed) throw new Error("Human texture decode failed");
    const meshes: Mesh[] = [];
    const regionMeshes = new Map<TwinBodyRegion, Mesh[]>();
    const regionOf = new Map<Mesh, TwinBodyRegion>();
    const overlays: Array<{
      region: TwinBodyRegion;
      tint: { value: Color };
      amount: { value: number };
    }> = [];
    let triangles = 0;
    const textureSet = new Set<Texture>();
    body.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      meshes.push(node);
      triangles += (node.geometry.index?.count ?? node.geometry.getAttribute("position").count) / 3;
      const id: unknown = node.userData["twinRegion"];
      if (id !== "neutral" && (typeof id !== "string" || !isTwinBodyRegion(id)))
        throw new Error("Unreviewed body-region mapping");
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) {
        if (!(material instanceof MeshStandardMaterial) || !material.map)
          throw new Error("Human asset lacks its reviewed textured PBR material");
        for (const map of [material.map, material.normalMap, material.roughnessMap]) {
          if (!map) continue;
          textureSet.add(map);
          const image = map.image as { width?: number; height?: number } | null;
          if (
            !image?.width ||
            !image.height ||
            Math.max(image.width, image.height) > HUMAN_ASSET_LIMITS.textureEdge
          )
            throw new Error("Human texture is missing or exceeds the mobile budget");
        }
        if (typeof id === "string" && isTwinBodyRegion(id)) {
          const tint = { value: new Color() };
          const amount = { value: 0 };
          material.onBeforeCompile = (shader) => {
            shader.uniforms["uTwinTint"] = tint;
            shader.uniforms["uTwinAmount"] = amount;
            shader.fragmentShader =
              "uniform vec3 uTwinTint;\nuniform float uTwinAmount;\n" +
              shader.fragmentShader.replace(
                "#include <color_fragment>",
                "#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, uTwinTint, uTwinAmount);",
              );
          };
          material.customProgramCacheKey = () => "twin-human-subtle-overlay-v1";
          overlays.push({ region: id, tint, amount });
        }
      }
      if (typeof id === "string" && isTwinBodyRegion(id)) {
        regionOf.set(node, id);
        regionMeshes.set(id, [...(regionMeshes.get(id) ?? []), node]);
      }
    });
    body.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(body, true);
    if (
      meshes.length === 0 ||
      meshes.length > HUMAN_ASSET_LIMITS.meshes ||
      triangles > HUMAN_ASSET_LIMITS.triangles ||
      regionMeshes.size === 0 ||
      bounds.isEmpty() ||
      bounds.min.y < -0.02 ||
      bounds.max.y < 1.5 ||
      bounds.max.y > 1.95 ||
      Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x)) > 0.54
    )
      throw new Error("Human asset framing or geometry budget is incompatible");
    let disposed = false;
    return {
      body,
      meshes,
      regionMeshes,
      regionOf,
      metrics: {
        triangles,
        meshes: meshes.length,
        textures: textureSet.size,
        bytes: buffer.byteLength,
      },
      applyDisplay(state: TwinSceneState, selected: string | null, natural: boolean) {
        for (const overlay of overlays) {
          const style = humanOverlayStyle(state, overlay.region, selected, natural);
          overlay.tint.value.set(style.color);
          overlay.amount.value = style.amount;
        }
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        disposeHumanScene(body);
        regionMeshes.clear();
        regionOf.clear();
      },
    };
  } catch (error) {
    disposeHumanScene(body);
    throw error;
  }
}
export type HumanBodyHandle = Awaited<ReturnType<typeof loadHumanBody>>;
